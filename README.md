# simple-container-schedules
Allows to `start` `stop` or `restart` a container by given interval
1. Setup simple-container-schedules as docker-container
2. Then set a label in your `docker-compose.yml` file with a **valid** cron-notation to perform actions on that container
https://crontab.guru/
## Examples

### Example compose for simple-container-schedules

```
version: '3.9'

services:
  schedules:
    image: simple-container-schedules
    container_name: schedules
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

### Restart a container every minute
```
version: '3.9'

services:
  testContainer:
    labels:
      - "simple.schedules.restart=* * * * *"
```

### Start a container every minute
```
version: '3.9'

services:
  testContainer:
    labels:
      - "simple.schedules.start=* * * * *"
```

### Stop a container every minute
```
version: '3.9'

services:
  testContainer:
    labels:
      - "simple.schedules.stop=* * * * *"
```