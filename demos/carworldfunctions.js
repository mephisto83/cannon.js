var randf = function (lo, hi) { return Math.random() * (hi - lo) + lo; }
var randi = function (lo, hi) { return Math.floor(randf(lo, hi)); }

function rl(ops) {
    var {
        agents = [],
        stepsPerTick = 1,
        trackWidth = 20
    } = ops;
    var w; // global world object
    var current_interval_id;
    var skipdraw = false;


    // agent parameter spec to play with (this gets eval()'d on Agent reset)
    var spec = {}
    spec.update = 'qlearn'; // qlearn | sarsa
    spec.gamma = 0.75; // discount factor, [0, 1)
    spec.epsilon = 0.1; // initial epsilon for epsilon-greedy policy, [0, 1)
    spec.alpha = 0.01; // value function learning rate
    spec.experience_add_every = 25; // number of time steps before we add another experience to replay memory
    spec.experience_size = 5000; // size of experience
    spec.learning_steps_per_iteration = 10;
    spec.tderror_clamp = 1.0; // for robustness
    spec.num_hidden_units = 100 // number of neurons in hidden layer
    var w_agents = null;
    function start() {

        var track = ops.createTrack();

        w = new World(ops.world, track, trackWidth);
        w.track = track;
        w.boundary = ops.boundary;
        w.trackWidth = trackWidth;
        w.createItem = ops.createItem;
        w.agents = [];
        if (ops.createItem) {
            w.items.map(item => {
                ops.createItem(item)
            });
        }
        w_agents = agents.map(agent_config => {
            let a = agent_config;
            let smooth_reward_history = [];
            let env = a;
            a.brain = new RL.DQNAgent(env, spec); // give agent a TD brain
            if (a.brainConfig) {
                a.brain.fromJSON(a.brainConfig);
            }
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
        return w;
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

    return {
        start,
        tick
    }
}