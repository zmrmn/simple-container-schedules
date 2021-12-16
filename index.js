const Docker = require('./docker.js');
const docker = new Docker();
const cron = require('cron').CronJob;

/**
 * app
 */
class app {
    constructor() {
        this.init();
        /**
         * List of Schedules
         */
        this._schedules = [];
    }

    /**
     * Initializes
    */
    init = async () => {
        //get all containers
        const containerList = await docker.getContainers({ all: true });
        //loop through containerList. Check if has label
        for (let container of containerList) {
            //if container has label
            let label = await this.getLabel(container);
            if (label) {
                //add
                await this.registerSchedule(container.Names[0].replace(/\//, ''), label);
            }
        }

        await docker.registerEvents(this.containerEventReceived)
    }

    /**
     * Callback for docker-container-events
     * @param {Object} data event
    */
    containerEventReceived = async (data) => {
        const eventContainerName = data.Actor.Attributes.name;

        //check if container exists in schedules
        const container = this._schedules.find(x => x.containerName == eventContainerName);
        if (container) {
            //found
            //check if has exact same label
            if (!(data.Actor.Attributes[container.config.label.key] && data.Actor.Attributes[container.config.label.key] == container.config.label.value)) {
                //if it not, unregister
                await this.unregisterFromSchedule(eventContainerName);

            }
        }

        //check if eventContainer has simple.schedules attribute
        let label = await this.getLabelByEvent(data);
        //also check if NOT already in schedules. If has label and NOT in schedules, add
        if (label && !(this._schedules.find(x => x.containerName == eventContainerName && x.config.label.text == label.label.text))) {
            //add
            await this.registerSchedule(eventContainerName, label)
        }
    }

    /**
     * Returns label-Object if any valid simple.schedules label is there
     * @param {Object} container container
     * @return {{label: {text:string, key:string, value:string}, schedule:string, interval:string}} returns config
     */
    getLabel = async (container) => {
        const labels = Object.keys(container.Labels).filter(x => x.match(/simple\.schedules\./i));

        if (labels.length > 1) {
            //more than one schedules label
            console.log(`[error] Container ${container.Id} - ${container.Names} has multiple 'simple.schedules.*' labels - ignoring`);
        }

        //add container to list
        if (labels.length == 1) {
            const command = labels[0].split('simple.schedules.')[1]
            //only these commands allowed
            if (["restart", "start", "stop"].includes(command)) {

                const interval = container.Labels[labels[0]];

                if (!(await this.isValidCron(interval))) {
                    console.log(`[error] Invalid schedule for ${container.Names} with ${interval}. Cant register.`);
                    return;
                }
                return {
                    label: {
                        text: `${labels[0]}=${interval}`,
                        key: labels[0],
                        value: interval
                    },
                    schedule: interval,
                    command
                }
            } else {
                console.log(`[error] Container ${container.Id} - ${container.Names} command ${command} is not allowed`)
                return;
            }

        }
    }

    /**
     * Returns label-Object if any valid simple.schedules label is there
     * @param {Object} event event
     * @return {{label: {text:string, key:string, value:string}, schedule:string, interval:string}} returns config
     */
    getLabelByEvent = async (event) => {
        const labels = Object.keys(event.Actor.Attributes).filter(x => x.match(/simple\.schedules\./i));

        if (labels.length > 1) {
            //more than one schedules label
            console.log(`[error] Container ${event.id} - ${event.Actor.Attributes.name} has multiple 'simple.schedules.*' labels - ignoring`);
        }

        //add container to list
        if (labels.length == 1) {
            const command = labels[0].split('simple.schedules.')[1]
            //only these commands allowed
            if (["restart", "start", "stop"].includes(command)) {

                const interval = event.Actor.Attributes[labels[0]];

                if (!(await this.isValidCron(interval))) {
                    console.log(`[error] Invalid schedule for ${event.Actor.Attributes.name} with ${interval}. Cant register.`);
                    return;
                }
                return {
                    label: {
                        text: `${labels[0]}=${interval}`,
                        key: labels[0],
                        value: interval
                    },
                    schedule: interval,
                    command
                }
            } else {
                console.log(`[error] Container ${event.id} - ${event.Actor.Attributes.name} command ${command} is not allowed`)
                return;
            }

        }
    }

    /**
     * returns true if cronTime is valid cron-syntax
     * @param {string} cronTime cronTime-Syntax
     * @return {boolean} valid or not
     */
    isValidCron = async (cronTime) => {
        try {
            new cron(cronTime, () => { });
            return true
        } catch (error) {
            return false;
        }
    }

    /**
     * executes on cron tick
     * @param {object} schedule object from schedules which is about to execute
     */
    execCron = async (schedule) => {
        //get container by Name
        let container = await docker.getContainers({ all: true, filters: { name: [schedule.containerName] } });

        if (container.length > 0) {
            //get container by id and execute commands
            container = await docker.getContainerById(container[0].Id);
            switch (schedule.config.command) {
                case 'start':
                    try {
                        await container.start()
                        console.log(`[info] Command ${schedule.config.command} successfully executed on ${schedule.containerName}`);

                    } catch (error) {
                        console.log(`[warning] Command ${schedule.config.command} executed on ${schedule.containerName} - with error: ${error.message}`)
                    }
                    break;
                case 'stop':
                    try {
                        await container.stop();
                        console.log(`[info] Command ${schedule.config.command} successfully executed on ${schedule.containerName}`);
                    } catch (error) {
                        console.log(`[warning] Command ${schedule.config.command} executed on ${schedule.containerName} - with error: ${error.message}`)
                    }
                    break;
                case 'restart':
                    try {
                        await container.restart();
                        console.log(`[info] Command ${schedule.config.command} successfully executed on ${schedule.containerName}`);
                    } catch (error) {
                        console.log(`[warning] Command ${schedule.config.command} executed on ${schedule.containerName} - with error: ${error.message}`)
                    }
                    break;
                default:
                    console.log(`[warning] Command ${schedule.config.command} unknown - requested from ${schedule.containerName}`);
                    break;

            }

            console.log(`next run ${schedule.cron.nextDates(1)}`);

        } else {
            //if container with that name doesnt exist in docker-environment, remove from schedule
            console.log(`[error] No Container with ${schedule.containerName} found. Cant execute command. Removing from schedule now.`);

            await this.unregisterFromSchedule(schedule.containerName);
        }
    }

    /**
     * unregisters from schedules
     * @param {string} name containerName
     */
    unregisterFromSchedule = async (name) => {
        let container = this._schedules.find(x => x.containerName == name);
        container.cron.stop();
        this._schedules = this._schedules.filter(x => x.containerName !== name);

        console.log(`[info] Container ${name} successfully unregistered`);
    }

    /**
     * registers in schedules
     * @param {string} name containerName
     * @param {object} name label-object returned by getLabel or getLabelByEvent
     */
    registerSchedule = async (name, label) => {
        const schedule = {
            config: label,
            containerName: name
        }

        //no timezone = servertime
        schedule.cron = new cron(schedule.config.schedule, async () => { await this.execCron(schedule) }, null, true);

        this._schedules.push(schedule);

        console.log(`[info] Container ${schedule.containerName} is registered with command ${schedule.config.command} with schedule ${schedule.config.schedule}`);
        console.log(`next run ${schedule.cron.nextDates(1)}`);
    }
}



new app();
