## pubsub 
A twitter bot wich subscribes to accounts and publish their tweets

### Node.js module dependencies
```
{
    "mongodb": "~1.4.31",
    "node-schedule": "~0.1.16",
    "q": "^1.1.2",
    "twitter": "~1.2.1",
    "yandex-translate": "~1.0.1"
}
```

### Configuration
Twitter account credentials should be provided via ENV varibales:
* TWITTER_CONSUMER_KEY,
* TWITTER_CONSUMER_SECRET,
* TWITTER_ACCESS_TOKEN_KEY,
* TWITTER_ACCESS_TOKEN_SECRET

MongoDb connection credentials should be provided via `MONGO_URL` ENV varibale

### Installation
```
$ git clone https://github.com/seliverstov/pubsub
$ cd pubsub
$ node app.js
```
