const AGENT_TYPE = 4;
const OBSTACLE = 3;
const REWARD = 2;
const BOUNDARY = 1;
const VISIBLE_TYPES = [REWARD, BOUNDARY];

function getEyes(count, range) {
    var r = 1;
    var total = 0;
    var N = count;
    var a = 4 * Math.PI * Math.pow(r, 2) / N;;
    var d = Math.sqrt(a);
    var Mv = Math.round(Math.PI / d);
    var dv = Math.PI / Mv;
    var dp = a / dv;
    var eyes = [];
    for (var m = 0; m < Mv; m++) {
        var v = Math.PI * (m + .5) / Mv;
        var Mp = Math.round(2 * Math.PI * Math.sin(v) / dp);
        for (var n = 0; n < Mp; n++) {
            var p = 2 * Math.PI * n / Mp;
            eyes.push(createEye(new THREE.Vector3(
                Math.sin(v) * Math.cos(p) * r,
                Math.sin(v) * Math.sin(p) * r,
                Math.cos(v) * r), range));
            total++;
        }
    }
    return eyes;
}

function createEye(vector, range) {
    // Eye sensor has a maximum range and senses walls
    var Eye = function (angle) {
        this.angle = angle; // angle relative to agent its on
        this.max_range = range || 120;
        this.length = range;
        this.sensed_proximity = range || 120; // what the eye is seeing. will be set in world.tick()
        this.sensed_type = -1; // what does the eye see?

        this.velocity = new THREE.Vector3(0, 0, 0); // sensed velocity
    }

    Eye.prototype = {
        position: function () {
            return this.angle.clone().multiplyScalar(this.length);
        }
    }

    return new Eye(vector);
}

function createAgent(ops) {
    ops = ops || { range: 100 };

    var { range } = ops;
    // A single agent
    var Agent = function (ops) {
        var { position, velocity, direction, radius, initPosition, numberOfEyes } = ops;
        // positional information
        this.position = position;
        this.initPosition = initPosition;
        this.velocity = velocity;// direction facing
        this.op = this.p; // old position
        this.angle = direction;
        this.type = AGENT_TYPE;

        this.actions = [];
        //this.actions.push([0,0]);
        for (var i = 0; i < 8; i++) {
            this.actions.push(i);
        }

        // properties
        this.rad = radius;
        this.eyes = getEyes(numberOfEyes, range)

        this.brain = null; // set from outside

        this.reward_bonus = 0.0;
        this.digestion_signal = 0.0;

        this.apples = 0;
        this.poison = 0;

        // outputs on world
        this.action = 0;

        this.prevactionix = -1;
        var direction_parts = 3;
        var velocity_parts = 3;
        var eye_parts = 4 + VISIBLE_TYPES.length;

        this.num_states = direction_parts + velocity_parts + this.eyes.length * eye_parts;
    }
    Agent.prototype = {
        getNumStates: function () {
            return this.num_states;
        },
        body: function (_body) {
            if (_body) {
                this._body = _body;
            }

            return this._body
        },
        init: function () {
            this.update();
            if (this.position) {
                this.position.x = this.initPosition.x;
                this.position.y = this.initPosition.y;
                this.position.z = this.initPosition.z;
                this.inited = true;
            }
        },
        update: function () {

            if (this._body && this._body.chassisBody) {
                this.position = this._body.chassisBody.position;
                this.velocity = this._body.chassisBody.velocity;
                this.direction = this._body.chassisBody.quaternion;
            }

        },
        getMaxNumActions: function () {
            return this.actions.length;
        },
        forward: function () {
            // in forward pass the agent simply behaves in the environment
            // create input to brain
            var num_eyes = this.eyes.length;
            var ne = num_eyes * 5;
            var input_array = [];//new Array(this.num_states);

            for (var i = 0; i < num_eyes; i++) {
                var offset = 0;
                var e = this.eyes[i];

                if (e.sensed_type !== -1) {
                    input_array.push(e.sensed_direction.x); // velocity information of the sensed target
                    input_array.push(e.sensed_direction.y);
                    input_array.push(e.sensed_direction.z);

                    input_array.push(e.sensed_proximity);
                    // sensed_type is 0 for wall, 1 for food and 2 for poison.
                    // lets do a 1-of-k encoding into the input array
                    VISIBLE_TYPES.map(t => {
                        if (e.sensed_type === t) {
                            input_array.push(1); // normalize to [0,1]
                        }
                        else {
                            input_array.push(0); // normalize to [0,1]
                        }
                    })
                }
                else {
                    input_array.push(0, 0, 0, 0);
                    VISIBLE_TYPES.map(t => {
                        input_array.push(0); // normalize to [0,1]
                    });
                }
            }
            debugger;
            // // proprioception and orientation
            // input_array[ne + 0] = this.v.x;
            // input_array[ne + 1] = this.v.y;

            input_array.push(this.velocity.x);
            input_array.push(this.velocity.y);
            input_array.push(this.velocity.z);

            input_array.push(this.direction.x);
            input_array.push(this.direction.y);
            input_array.push(this.direction.z);

            this.action = this.brain.act(input_array);
            //var action = this.actions[actionix];
            // demultiplex into behavior variables
            //this.action = action;
        },
        backward: function () {
            var reward = this.digestion_signal;

            // var proximity_reward = 0.0;
            // var num_eyes = this.eyes.length;
            // for(var i=0;i<num_eyes;i++) {
            //   var e = this.eyes[i];
            //   // agents dont like to see walls, especially up close
            //   proximity_reward += e.sensed_type === 0 ? e.sensed_proximity/e.max_range : 1.0;
            // }
            // proximity_reward = proximity_reward/num_eyes;
            // reward += proximity_reward;

            //var forward_reward = 0.0;
            //if(this.actionix === 0) forward_reward = 1;

            this.last_reward = reward; // for vis
            this.brain.learn(reward);
        }
    }

    return Agent;
}

// item is circle thing on the floor that agent can interact with (see or eat, etc)
var Item = function (position, velocity, type, id) {
    this.position = position; // position
    this.velocity = velocity;
    this.id = id;
    this.type = type;
    this.rad = 10; // default radius
    this.age = 0;
    this.cleanup_ = false;
}

var World = function (cannonWorld) {
    this.agents = [];
    this.W = 1000;
    this.H = 1000;
    this.cannonWorld = cannonWorld;

    this.clock = 0;

    // set up walls in the world

    // set up food and poison
    this.items = []
    for (var k = 0; k < 50; k++) {
        var position = new THREE.Vector3(randf(20, this.W - 20), randf(20, this.H - 20), 0);;
        var velocity = new THREE.Vector3(0, 0, 0);
        var types = VISIBLE_TYPES;
        var t = types[randi(0, types.length)]; // food or poison (1 and 2)
        var it = new Item(position, velocity, t, k);
        this.items.push(it);
    }
}

World.prototype = {
    // helper function to get closest colliding walls/items
    stuff_collide_: function (p1, p2, check_walls, check_items) {
        var minres = false;

        // collide with walls
        // if (check_walls) {
        //     for (var i = 0, n = this.walls.length; i < n; i++) {
        //         var wall = this.walls[i];
        //         var res = line_intersect(p1, p2, wall.p1, wall.p2);
        //         if (res) {
        //             res.type = 0; // 0 is wall
        //             if (!minres) { minres = res; }
        //             else {
        //                 // check if its closer
        //                 if (res.ua < minres.ua) {
        //                     // if yes replace it
        //                     minres = res;
        //                 }
        //             }
        //         }
        //     }
        // }

        // collide with items
        if (check_items) {
            for (var i = 0, n = this.items.length; i < n; i++) {
                var it = this.items[i];
                var res = line_point_intersect(p1, p2, it.p, it.rad);
                if (res) {
                    res.type = it.type; // store type of item
                    res.vx = it.v.x; // velocty information
                    res.vy = it.v.y;
                    if (!minres) { minres = res; }
                    else {
                        if (res.ua < minres.ua) { minres = res; }
                    }
                }
            }
        }

        return minres;
    },
    see: function (agent, eye) {

        var position = agent.position.clone().vadd(eye.position());
        var sortedItems = [...this.items, ...this.agents].filter(t => {
            return agent !== t && eye.max_range > position.distanceTo(t.position);
        }).sort((a, b) => {
            return position.distanceTo(a.position) - position.distanceTo((b.position));
        });

        if (sortedItems && sortedItems.length) {
            return sortedItems[0];
        }
        return false;
    },
    tick: function () {
        // tick the environment
        this.clock++;

        // fix input to all agents based on environment
        // process eyes
        for (var i = 0, n = this.agents.length; i < n; i++) {
            var a = this.agents[i];
            for (var ei = 0, ne = a.eyes.length; ei < ne; ei++) {
                var e = a.eyes[ei];
                // we have a line from p to p->eyep
                var res = this.see(a, e);
                if (res) {
                    // eye collided with wall
                    var eye_position = a.position.clone().vadd(e.position());
                    e.sensed_proximity = res.position.distanceTo(eye_position) / e.max_range;
                    e.sensed_direction = res.position.sub ? res.position.sub(eye_position).normalize() : res.position.vsub(eye_position).unit();
                    e.sensed_type = res.type;
                    if ('velocity' in res) {
                        e.velocity = res.velocity;
                    } else {
                        e.velocity = new THREE.Vector3(0, 0, 0);
                    }
                } else {
                    e.sensed_proximity = e.max_range;
                    e.sensed_type = -1;
                    e.velocity = new THREE.Vector3(0, 0, 0);
                }
            }
        }

        // let the agents behave in the world based on their input
        for (var i = 0, n = this.agents.length; i < n; i++) {
            this.agents[i].forward();
        }

        // apply outputs of agents on evironment
        for (var i = 0, n = this.agents.length; i < n; i++) {
            var a = this.agents[i];
            a.op = a.p; // back up old position
            a.oangle = a.angle; // and angle

            // execute agent's desired action
            a.applyAction();
            // var speed = 1;
            // if (a.action === 0) {
            //     a.v.x += -speed;
            // }
            // if (a.action === 1) {
            //     a.v.x += speed;
            // }
            // if (a.action === 2) {
            //     a.v.y += -speed;
            // }
            // if (a.action === 3) {
            //     a.v.y += speed;
            // }

            // forward the agent by velocity
            // a.v.x *= 0.95; a.v.y *= 0.95;
            // a.p.x += a.v.x; a.p.y += a.v.y;

            // agent is trying to move from p to op. Check walls
            //var res = this.stuff_collide_(a.op, a.p, true, false);
            //if(res) {
            // wall collision...
            //}

            // handle boundary conditions.. bounce agent
            // if (a.p.x < 1) { a.p.x = 1; a.v.x = 0; a.v.y = 0; }
            // if (a.p.x > this.W - 1) { a.p.x = this.W - 1; a.v.x = 0; a.v.y = 0; }
            // if (a.p.y < 1) { a.p.y = 1; a.v.x = 0; a.v.y = 0; }
            // if (a.p.y > this.H - 1) { a.p.y = this.H - 1; a.v.x = 0; a.v.y = 0; }

            // if(a.p.x<0) { a.p.x= this.W -1; };
            // if(a.p.x>this.W) { a.p.x= 1; }
            // if(a.p.y<0) { a.p.y= this.H -1; };
            // if(a.p.y>this.H) { a.p.y= 1; };
        }

        // tick all items
        var update_items = false;
        for (var j = 0, m = this.agents.length; j < m; j++) {
            var a = this.agents[j];
            a.digestion_signal = 0; // important - reset this!
        }
        for (var i = 0, n = this.items.length; i < n; i++) {
            var it = this.items[i];
            it.age += 1;

            // see if some agent gets lunch
            for (var j = 0, m = this.agents.length; j < m; j++) {
                var a = this.agents[j];
                var d = a.p.dist_from(it.p);
                if (d < it.rad + a.rad) {

                    // wait lets just make sure that this isn't through a wall
                    //var rescheck = this.stuff_collide_(a.p, it.p, true, false);
                    var rescheck = false;
                    if (!rescheck) {
                        // ding! nom nom nom
                        if (it.type === 1) {
                            a.digestion_signal += 1.0; // mmm delicious apple
                            a.apples++;
                        }
                        if (it.type === 2) {
                            a.digestion_signal += -1.0; // ewww poison
                            a.poison++;
                        }
                        it.cleanup_ = true;
                        update_items = true;
                        break; // break out of loop, item was consumed
                    }
                }
            }

            // // move the items
            // it.p.x += it.v.x;
            // it.p.y += it.v.y;
            // if (it.p.x < 1) { it.p.x = 1; it.v.x *= -1; }
            // if (it.p.x > this.W - 1) { it.p.x = this.W - 1; it.v.x *= -1; }
            // if (it.p.y < 1) { it.p.y = 1; it.v.y *= -1; }
            // if (it.p.y > this.H - 1) { it.p.y = this.H - 1; it.v.y *= -1; }

            // if (it.age > 5000 && this.clock % 100 === 0 && randf(0, 1) < 0.1) {
            //     it.cleanup_ = true; // replace this one, has been around too long
            //     update_items = true;
            // }

        }
        // if (update_items) {
        //     var nt = [];
        //     for (var i = 0, n = this.items.length; i < n; i++) {
        //         var it = this.items[i];
        //         if (!it.cleanup_) nt.push(it);
        //     }
        //     this.items = nt; // swap
        // }
        // if (this.items.length < 50 && this.clock % 10 === 0 && randf(0, 1) < 0.25) {
        //     var newitx = randf(20, this.W - 20);
        //     var newity = randf(20, this.H - 20);
        //     var newitt = randi(1, 3); // food or poison (1 and 2)
        //     var newit = new Item(newitx, newity, newitt);
        //     this.items.push(newit);
        // }

        // agents are given the opportunity to learn based on feedback of their action on environment
        for (var i = 0, n = this.agents.length; i < n; i++) {
            this.agents[i].backward();
        }
    }
}