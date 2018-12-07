var randf = function (lo, hi) { return Math.random() * (hi - lo) + lo; }
var randi = function (lo, hi) { return Math.floor(randf(lo, hi)); }

function createGroundContactMaterial() {
    var groundMaterial = new CANNON.Material("groundMaterial");
    var wheelMaterial = new CANNON.Material("wheelMaterial");
    var itemMaterial = new CANNON.Material("itemMaterial");
    var vehicleMaterial = new CANNON.Material("vehicleMaterial");

    var wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
        friction: 0.5,
        restitution: 0,
        contactEquationStiffness: 1000
    });

    var itemVehicleContactMaterial = new CANNON.ContactMaterial(itemMaterial, vehicleMaterial, {
        friction: 0.5,
        restitution: 0,
        contactEquationStiffness: 1000
    });

    return {
        itemVehicleContactMaterial,
        vehicleMaterial,
        itemMaterial,
        groundMaterial,
        wheelMaterial,
        wheelGroundContactMaterial
    };
}



function createVehicle(ops) {
    var { wheelMaterial, vehicleMaterial } = ops;

    var chassisShape;
    var centerOfMassAdjust = new CANNON.Vec3(0, 0, -1);
    chassisShape = new CANNON.Box(new CANNON.Vec3(5, 2, 0.5));
    var chassisBody = new CANNON.Body({ mass: 5, material: vehicleMaterial });
    chassisBody.addShape(chassisShape, centerOfMassAdjust);
    chassisBody.position.set(0, 0, 0);

    // Create the vehicle
    vehicle = new CANNON.RigidVehicle({
        chassisBody: chassisBody
    });

    var axisWidth = 7;
    var wheelShape = new CANNON.Sphere(1.5);
    var down = new CANNON.Vec3(0, 0, -1);

    var wheelBody = new CANNON.Body({ mass: mass, material: wheelMaterial });
    wheelBody.addShape(wheelShape);
    vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(5, axisWidth / 2, 0).vadd(centerOfMassAdjust),
        axis: new CANNON.Vec3(0, 1, 0),
        direction: down
    });

    var wheelBody = new CANNON.Body({ mass: mass, material: wheelMaterial });
    wheelBody.addShape(wheelShape);
    vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(5, -axisWidth / 2, 0).vadd(centerOfMassAdjust),
        axis: new CANNON.Vec3(0, -1, 0),
        direction: down
    });

    var wheelBody = new CANNON.Body({ mass: mass, material: wheelMaterial });
    wheelBody.addShape(wheelShape);
    vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(-5, axisWidth / 2, 0).vadd(centerOfMassAdjust),
        axis: new CANNON.Vec3(0, 1, 0),
        direction: down
    });

    var wheelBody = new CANNON.Body({ mass: mass, material: wheelMaterial });
    wheelBody.addShape(wheelShape);
    vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(-5, -axisWidth / 2, 0).vadd(centerOfMassAdjust),
        axis: new CANNON.Vec3(0, -1, 0),
        direction: down
    });

    // Some damping to not spin wheels too fast
    for (var i = 0; i < vehicle.wheelBodies.length; i++) {
        vehicle.wheelBodies[i].angularDamping = 0.4;
    }

    return vehicle;
}

function addVehicleVisuals(demo, vehicle) {

    // Add visuals
    demo.addVisual(vehicle.chassisBody);
    for (var i = 0; i < vehicle.wheelBodies.length; i++) {
        demo.addVisual(vehicle.wheelBodies[i]);
    }
}

function addGround(groundMaterial, size) {
    var mock = false;
    var matrix = [];
    var sizeX = size || 164,
        sizeY = sizeX;

    for (var i = 0; i < sizeX; i++) {
        matrix.push([]);
        for (var j = 0; j < sizeY; j++) {
            var height = Math.sin(i / sizeX * Math.PI * 8) * Math.sin(j / sizeY * Math.PI * 8) * 8 + 8;
            if (i === 0 || i === sizeX - 1 || j === 0 || j === sizeY - 1)
                height = 10;

            matrix[i].push(height);
        }
    }

    var hfShape = new CANNON.Heightfield(matrix, {
        elementSize: 3000 / sizeX
    });
    var hfBody;

    var quat = new CANNON.Quaternion();
    var pos = new CANNON.Vec3(-sizeX * hfShape.elementSize / 2, -20, -20);

    // Use normal
    hfBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    hfBody.addShape(hfShape, new CANNON.Vec3(0, 0, -1), new CANNON.Quaternion());
    hfBody.position.copy(pos);
    hfBody.quaternion.copy(quat);

    return hfBody;
}


function rl(ops) {
    var {
        agents = [],
        stepsPerTick = 1
    } = ops;
    var w; // global world object
    var current_interval_id;
    var skipdraw = false;


    // agent parameter spec to play with (this gets eval()'d on Agent reset)
    var spec = {}
    spec.update = 'qlearn'; // qlearn | sarsa
    spec.gamma = 0.9; // discount factor, [0, 1)
    spec.epsilon = 0.2; // initial epsilon for epsilon-greedy policy, [0, 1)
    spec.alpha = 0.005; // value function learning rate
    spec.experience_add_every = 5; // number of time steps before we add another experience to replay memory
    spec.experience_size = 10000; // size of experience
    spec.learning_steps_per_iteration = 5;
    spec.tderror_clamp = 1.0; // for robustness
    spec.num_hidden_units = 100 // number of neurons in hidden layer
    var w_agents = null;
    function start() {

        w = new World();
        w.agents = [];

        w_agents = agents.map(agent_config => {
            let a = agent_config;
            let smooth_reward_history = [];
            let env = a;
            a.brain = new RL.DQNAgent(env, spec); // give agent a TD brain
            //a.brain = new RL.RecurrentReinforceAgent(env, {});
            w.agents.push(a);
            smooth_reward_history.push([]);
            return {
                agent: a,
                smooth_reward: [],
                smooth_reward_history,
                epsilon: function (value) {
                    a.brain.epsilon = value;
                }
            }
        });


        initFlot();

    }
    var nflot = 1000;
    let flott = 0;
    function tick() {

        for (var k = 0; k < stepsPerTick; k++) {
            w.tick();
        }

        flott += 1;
        for (i = 0; i < w.agents.length; i++) {
            var rew = w.agents[i].last_reward;
            var smooth_reward = w_agents.smooth_reward;
            if (!smooth_reward) {
                smooth_reward = 0;
            }

            smooth_reward = smooth_reward * 0.999 + rew * 0.001;

            if (flott === 50) {
                // record smooth reward
                var smooth_reward_history = w_agents[i].smooth_reward_history;
                if (smooth_reward_history.length >= nflot) {
                    smooth_reward_history = smooth_reward_history.slice(1);
                }
                smooth_reward_history.push(smooth_reward);
            }
        }
        if (flott === 50) {
            flott = 0;
        }
    }

    function initFlot() {

        function getFlotRewards(agentId) {
            // zip rewards into flot data
            var res = [];
            if (agentId >= w.agents.length || !smooth_reward_history[agentId]) {
                return res;
            }
            for (var i = 0, n = smooth_reward_history[agentId].length; i < n; i++) {
                res.push([i, smooth_reward_history[agentId][i]]);
            }
            return res;
        }
    }
    return {
        start,
        tick
    }
}