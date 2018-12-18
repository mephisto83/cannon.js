const AGENT_TYPE = 4;
const OBSTACLE = 3;
const REWARD = 2;
const BOUNDARY = 1;
const VISIBLE_TYPES = [REWARD, OBSTACLE];

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
        this.max_range = range || 1200;
        this.length = range;
        this.sensed_proximity = range || 1200; // what the eye is seeing. will be set in world.tick()
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
const registration = {};;
function register(index, obj) {
    registration[index] = obj;
}
function whatTypeIsIndex(index) {
    if (registration[index]) {
        return registration[index].type;
    }
    return false;
}
function createAgent(ops) {
    ops = ops || { range: 100 };

    var { range } = ops;
    // A single agent
    var Agent = function (ops) {
        var { position, velocity, direction, radius, initPosition, numberOfEyes } = ops;
        // positional information
        this.position = null;
        this.initPosition = initPosition;
        this.velocity = null;// direction facing
        this.op = this.p; // old position
        this.age = 0;
        this.angle = direction;
        this.type = AGENT_TYPE;

        this.actions = [];
        var actionCount = 6;
        //this.actions.push([0,0]);
        for (var i = 0; i < actionCount; i++) {
            this.actions.push(i);
        }

        // properties
        this.rad = radius;
        this.eyes = getEyes(numberOfEyes, range)

        this.brain = null; // set from outside

        this.reward_bonus = 0.0;
        this.digestion_signal = 0.0;

        this.rewards = 0;
        this.agents = 0;
        this.obstacles = 0;
        this.speed = 0;

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
        score: function () {
            return this.rewards - this.obstacles - this.agents + this.speed * .001 + this.age * .01;
        },
        body: function (_body) {
            var me = this;
            if (_body) {
                this._body = _body;
                this._body.chassisBody.addEventListener('collide', function (evt) {
                    var index = me.getCollisionIndex();
                    if (evt && (evt.target.index === index || evt.body.index === index)) {
                        if (me._body && me._body.chassisBody) {
                            register(me._body.chassisBody.index, me);
                            me._body.wheelBodies.map(t => {
                                register(t.index, me);
                            })
                        }
                        me.collided = true;
                        me.collisionEvent = evt;
                    }
                });
            }

            return this._body
        },

        world: function (_world) {
            if (_world) {
                this._world = _world;
            }

            return this._world
        },

        update: function () {
            this.position = this.body().chassisBody.position;
            this.velocity = this.body().chassisBody.velocity;
            register(this._body.chassisBody.index, this);
            this._body.wheelBodies.map(t => {
                register(t.index, me);
            })
        },

        remove: function () {
            if (this.body()) {
                var me = this;
                this.body().removeFromWorld(this._world);
                // this._world.remove(this.body().chassisBody);
                // this._world.removeBody(this.body().chassisBody);

                this._world.scene.remove(this._body.chassisBody.visualref);
                me._body.wheelBodies.map(t => {
                    me._world.scene.remove(t.visualref);
                })
                this._body = null;
            }
        },
        getCollisionIndex: function () {
            var me = this;
            var body = me.body();

            if (body) {
                return body.chassisBody.index;
            }
            return null;
        },
        applyAction: function () {

            var maxSteerVal = Math.PI / 8;
            var maxSpeed = 10;
            var maxForce = 600;

            switch (this.action) {
                case 0: // forward
                    vehicle.setWheelForce(maxForce, 2);
                    vehicle.setWheelForce(-maxForce, 3);
                    vehicle.setSteeringValue(0, 0);
                    vehicle.setSteeringValue(0, 1);
                    break;

                // case 1: // backward
                //     vehicle.setWheelForce(-maxForce / 2, 2);
                //     vehicle.setWheelForce(maxForce / 2, 3);
                //     break;

                case 1: // forward left
                    vehicle.setWheelForce(maxForce, 2);
                    vehicle.setWheelForce(-maxForce, 3);
                    vehicle.setSteeringValue(maxSteerVal, 0);
                    vehicle.setSteeringValue(maxSteerVal, 1);
                    break;
                case 2: // forward right
                    vehicle.setWheelForce(maxForce, 2);
                    vehicle.setWheelForce(-maxForce, 3);
                    vehicle.setSteeringValue(-maxSteerVal, 0);
                    vehicle.setSteeringValue(-maxSteerVal, 1);
                    break;
                // case 2: // back left
                //     vehicle.setWheelForce(-maxForce / 2, 2);
                //     vehicle.setWheelForce(maxForce / 2, 3);
                //     vehicle.setSteeringValue(maxSteerVal, 0);
                //     vehicle.setSteeringValue(maxSteerVal, 1);
                //     break;
                // case 3: // back right
                //     vehicle.setWheelForce(-maxForce / 2, 2);
                //     vehicle.setWheelForce(maxForce / 2, 3);
                //     vehicle.setSteeringValue(-maxSteerVal, 0);
                //     vehicle.setSteeringValue(-maxSteerVal, 1);
                //     break;
                case 3: // break
                    vehicle.setWheelForce(0, 2);
                    vehicle.setWheelForce(0, 3);
                    vehicle.setSteeringValue(0, 0);
                    vehicle.setSteeringValue(0, 1);
                    break;

                case 4: // light forward left
                    vehicle.setWheelForce(maxForce / 2, 2);
                    vehicle.setWheelForce(-maxForce / 2, 3);
                    vehicle.setSteeringValue(maxSteerVal, 0);
                    vehicle.setSteeringValue(maxSteerVal, 1);
                    break;
                case 5: // light forward right
                    vehicle.setWheelForce(maxForce / 2, 2);
                    vehicle.setWheelForce(-maxForce / 2, 3);
                    vehicle.setSteeringValue(-maxSteerVal, 0);
                    vehicle.setSteeringValue(-maxSteerVal, 1);
                    break;
                default:
                    throw 'not defined action, buddy';
            }
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
                    // sensed_type is 0 for wall, 1 for food and 2 for obstacles.
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
    this._body = null;
    this.cleanup_ = false;
}
Item.prototype = {
    body: function (_body) {
        var me = this;
        if (_body) {
            this._body = _body;

            this._body.addEventListener('collide', function (evt) {
                var index = me.getCollisionIndex();
                if (evt && (evt.target.index === index || evt.body.index === index)) {
                    me.collided = true;
                    me.collisionEvent = evt;
                }
            });

            register(this._body.index, this);
        }

        return this._body
    },
    move: function (pos) {
        if (this._body) {
            this._body.position.x = pos.x;
            this._body.position.y = pos.y;
            this._body.position.z = pos.z;
        }
    },
    world: function (_world) {
        if (_world) {
            this._world = _world;
        }

        return this._world
    },
    update: function () {
        this.position = this.body().position;
        this.velocity = this.body().velocity;
        register(this._body.index, this);
    },
    getCollisionIndex: function () {
        var me = this;
        var body = me.body();

        if (body) {
            return body.index;
        }

        return null;
    },
    remove: function () {
        var me = this;
        if (this.body()) {
            this._world.remove(this.body());
            // this.body().shapes.map(t => {
            //     me._world.scene.remove(t);
            // })
            //this.body().removeFromWorld(this._world);
            this._world.scene.remove(this._body.visualref);
            this._body = null;
        }
    }
}
var World = function (cannonWorld, track, trackWidth) {
    this.agents = [];
    this.clock = 0;

    // set up walls in the world

    // set up food and obstacles
    this.items = []
    this.ids = 1;
    for (var j = -10; j < 10; j = j + 2) {
        for (var k = 0; k < 20; k = k + 2) {
            // var position = (new THREE.Vector3(j * randf(-40, 40), k * randf(-40, 40), 20)).add(track[Math.abs((j * k + k) % track.length)]);;
            // var velocity = new THREE.Vector3(0, 0, 0);
            // var types = VISIBLE_TYPES;
            // var t = types[randi(0, types.length)]; // food or obstacles (1 and 2)
            // var it = new Item(position, velocity, t, this.ids++);
            // this.items.push(it);
        }
    }
}

World.prototype = {
    addItem(position, velocity) {
        var me = this;
        var types = VISIBLE_TYPES;
        position = position || me.randomLocation();
        velocity = velocity || new THREE.Vector3(0, 0, 0);
        var t = types[randi(0, types.length)]; // food or obstacles (1 and 2)
        var it = new Item(position, velocity, t, this.ids++);
        this.items.push(it);
        return it;
    },
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
        var dist_to_boundary = this.calculateDistanceToBoundary(position);

        if (sortedItems && sortedItems.length) {
            if (position.distanceTo(sortedItems[0].position) < dist_to_boundary)
                return sortedItems[0];
            else {
                return this.boundaryObject();
            }
        }
        return false;
    },
    boundaryObject: function () {
        return {
            type: BOUNDARY
        }
    },
    isOutSideBoundary: function (pos) {
        if (this.boundary) {
            var len = this.calculateDistanceToBoundary(pos);
            return len > this.boundary.center.radius;
        }
    },
    calculateDistanceToBoundary: function (pos) {
        if (this.boundary) {
            var len = (new THREE.Vector3(pos.x, pos.y, pos.z)).sub(new THREE.Vector3(this.boundary.center.x, this.boundary.center.y, pos.z)).length();
            return len;
        }
    },
    directionToBoundary: function (pos) {
        if (this.boundary) {
            var len = (new THREE.Vector3(pos.x, pos.y, pos.z)).sub(new THREE.Vector3(this.boundary.center.x, this.boundary.center.y, pos.z)).normalize();
            return len;
        }
    },
    randomLocation: function () {
        var rad = this.boundary.center.radius * Math.random();
        return new THREE.Vector3(
            rad * Math.cos(Math.random() * 2 * Math.PI) + this.boundary.center.x,
            rad * Math.sin(Math.random() * 2 * Math.PI) + this.boundary.center.y,
            100);
    },
    tick: function () {
        // tick the environment
        this.clock++;
        var track = this.track;
        var minimum_agent_speed = this.minimum_agent_speed;
        var absolute_minimum_agent_speed = this.absolute_minimum_agent_speed;
        // fix input to all agents based on environment
        // process eyes
        for (var i = 0, n = this.agents.length; i < n; i++) {
            var a = this.agents[i];
            // for (var ei = 0, ne = a.eyes.length; ei < ne; ei++) {
            //     var e = a.eyes[ei];
            //     // we have a line from p to p->eyep
            //     var res = this.see(a, e);
            //     if (res) {
            //         // eye collided with wall
            //         var eye_position = a.position.clone().vadd(e.position());
            //         if (res.type !== BOUNDARY) {
            //             e.sensed_proximity = res.position.distanceTo(eye_position) / e.max_range;
            //             e.sensed_direction = res.position.sub ? res.position.sub(eye_position).normalize() : res.position.vsub(eye_position).unit();
            //         }
            //         else {
            //             e.sensed_direction = this.directionToBoundary(eye_position);
            //             e.sensed_proximity = this.calculateDistanceToBoundary(eye_position) / e.max_range;
            //         }
            //         e.sensed_type = res.type;
            //         if ('velocity' in res) {
            //             e.velocity = res.velocity;
            //         } else {
            //             e.velocity = new THREE.Vector3(0, 0, 0);
            //         }
            //     } else {
            //         e.sensed_proximity = e.max_range;
            //         e.sensed_type = -1;
            //         e.velocity = new THREE.Vector3(0, 0, 0);
            //     }
            // }
            // var sorted = track.sort((p, b) => {
            //     return a.position.distanceTo(p) - a.position.distanceTo(b);
            // });
            // var _ = sorted[0].distanceTo(a.position);
            // a.distanceToTrack = _;
            // if (this.boundary) {
            //     a.distanceToBoundary = this.calculateDistanceToBoundary(a.position);
            //     a.outsideBoundary = this.isOutSideBoundary(a.position);
            // }
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
        var update_agents = false;
        for (var j = 0, m = this.agents.length; j < m; j++) {
            var a = this.agents[j];
            a.age += 1;;
            a.digestion_signal = 0; // important - reset this!
        }

        if (this.items) {
            for (var i = 0, n = this.items.length; i < n; i++) {
                var it = this.items[i];
                it.age += 1;
                if (it.collided) {
                    if (registration[it.collisionEvent.target.index] !== registration[it.collisionEvent.body.index]) {
                        var hitType = whatTypeIsIndex(it.collisionEvent.target.index);
                        if (whatTypeIsIndex(it.collisionEvent.body.index) !== false)
                            switch (whatTypeIsIndex(it.collisionEvent.target.index)) {
                                case AGENT_TYPE:
                                    it.cleanup_ = true;
                                    update_items = true;
                                    break;
                            }
                    }
                    it.collided = false;
                }
            }
        }
        for (var j = 0, m = this.agents.length; j < m; j++) {
            var ag = this.agents[j];

            // var speed = a.velocity.length();
            // a.digestion_signal += speed;


            if (!ag.onTrack()) {
                ag.digestion_signal += -1;
                update_agents = true;
                ag.dead = true;
            }


            // if (ag.distanceToTrack > this.trackWidth) {
            //     ag.digestion_signal += -1;
            // }
            // else {
            //     ag.digestion_signal += .2;
            // }
            // if (ag.collided) {
            //     if (registration[ag.collisionEvent.target.index] !== registration[ag.collisionEvent.body.index]) {
            //         var hitType = whatTypeIsIndex(ag.collisionEvent.target.index);
            //         if (whatTypeIsIndex(ag.collisionEvent.body.index) !== false)
            //             switch (hitType) {
            //                 case REWARD:
            //                     ag.digestion_signal += 1.0; // mmm delicious apple
            //                     ag.rewards++;
            //                     break;
            //                 case OBSTACLE:
            //                     ag.digestion_signal += -1.0; // mmm delicious apple
            //                     ag.obstacles++;
            //                     ag.dead = true;
            //                     break;
            //                 case AGENT_TYPE:
            //                     ag.digestion_signal += -1.0; // mmm delicious apple
            //                     ag.agents++;
            //                     ag.dead = true;
            //                     update_agents = true;
            //                     break;

            //             }
            //     }
            //     ag.collided = false;
            // }
        }
        // for (var i = 0, n = this.items.length; i < n; i++) {
        //     var it = this.items[i];
        //     it.age += 1;

        //     // see if some agent gets lunch
        //     for (var j = 0, m = this.agents.length; j < m; j++) {
        //         var a = this.agents[j];
        //         var d = this.cannonWorld.collisionMatrix.get(a.getCollisionIndex(), (it.getCollisionIndex()));
        //         if (d) {
        //             debugger
        //             // wait lets just make sure that this isn't through a wall
        //             //var rescheck = this.stuff_collide_(a.p, it.p, true, false);
        //             var rescheck = false;
        //             if (!rescheck) {
        //                 // ding! nom nom nom
        //                 if (it.type === REWARD) {
        //                     a.digestion_signal += 1.0; // mmm delicious apple
        //                     a.rewards++;
        //                 }
        //                 if (it.type === OBSTACLE) {
        //                     a.digestion_signal += -1.0; // ewww obstacles
        //                     a.obstacles++;
        //                 }
        //                 it.cleanup_ = true;
        //                 update_items = true;
        //                 break; // break out of loop, item was consumed
        //             }
        //         }
        //     }

        //     // // move the items

        // }
        if (update_items && this.items) {
            var nt = [];

            for (var i = 0, n = this.items.length; i < n; i++) {
                var it = this.items[i];
                if (!it.cleanup_) {
                    nt.push(it);
                }
                else {
                    it.remove();
                    var newitem = this.addItem();
                    this.createItem(newitem)
                }
            }
            this.items = nt; // swap
        }

        if (update_agents) {
            var na = [];
            for (var i = 0, n = this.agents.length; i < n; i++) {
                var ag = this.agents[i];
                if (ag.dead) {
                    ag.remove();
                }
                else {
                    na.push(ag);
                }
            }
            this.agents = na;
        }


        // for (var j = 0, m = this.agents.length; j < m; j++) {
        //     this.agents[j].update();
        // }
        if (this.items)
            for (var j = 0, m = this.items.length; j < m; j++) {
                this.items[j].update();
            }
        // if (this.items.length < 50 && this.clock % 10 === 0 && randf(0, 1) < 0.25) {
        //     var newitx = randf(20, this.W - 20);
        //     var newity = randf(20, this.H - 20);
        //     var newitt = randi(1, 3); // food or obstacles (1 and 2)
        //     var newit = new Item(newitx, newity, newitt);
        //     this.items.push(newit);
        // }

        // agents are given the opportunity to learn based on feedback of their action on environment
        for (var i = 0, n = this.agents.length; i < n; i++) {
            this.agents[i].backward();
        }
    }
}