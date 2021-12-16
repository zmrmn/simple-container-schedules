const Docker = require("dockerode");
class docker {
    constructor() {
        this._docker = new Docker({ socketPath: '/var/run/docker.sock' });
    }
    /**
     * registers eventHandler for container-events
     * @param {function} callback callback
     */
    registerEvents = async (callback) => {
        return await this._docker.getEvents({ filters: { type: ["container"] } }, (err, stream) => {

            if (err) {
                console.log(`[error] eventError: ${err.message}`)
            } else {
                stream.setEncoding('utf-8');

                stream.on('data', function (chunk) {
                    callback(JSON.parse(chunk));
                });
            }
        });
        //if event restart start stop
    }

    /**
     * returns list of containers with given options
     * @param {object} opts options
     * @return {[{}]}
     */
    getContainers = async (opts = {}) => {
        try {
            return await this._docker.listContainers(opts);
        } catch (error) {
            console.log(error)
        }
    }

    /**
     * returns container
     * @param {string} id containerId
     * @return {{}}
     */
    getContainerById = async (id) => {
        return await this._docker.getContainer(id);
    }
}

module.exports = docker;