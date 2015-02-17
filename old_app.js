var Twitter = require('twitter');
var schedule = require('node-schedule');
var MongoClient = require('mongodb').MongoClient;
var translate = require('yandex-translate');

var client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

var since_id;

var job;

MongoClient.connect(process.env.MONGO_URL, function(err, db) {
    if(err) throw err;
    var collection = db.collection('tweets');
    collection.count(function(err, count){
      if (count===0){
        console.log('Initial load');
        initialLoad(function(){
          collection.findOne({},{sort:[['id','desc']]},function(err,doc){
            if (!err){
              console.log('Sent since value to '+doc.id);
              since_id = doc.id;
              job = schedule.scheduleJob({}, getResentTweets);
            }else{
              console.log(err);
            }
            db.close();
          });

        });
      }else{
        collection.findOne({},{sort:[['id','desc']]},function(err,doc){
          if (!err){
            console.log('Sent since value to '+doc.id);
            since_id = doc.id;
            job = schedule.scheduleJob({}, getResentTweets);
          }else{
            console.log(err);
          }
          db.close();
        });
      }
    });
});

function getResentTweets(){
  var params = {
    screen_name: 'UberFacts',
    count: 200,
    include_rts: false,
    exclude_replies: true,
    since_id: since_id
  };

  client.get('statuses/user_timeline.json',params,function(error, tweets, response){
    if (!error){
      if (tweets.length>0 && tweets[tweets.length-1].id===since_id){
        tweets.pop();
      }
      if (tweets.length > 0){
        console.log('Get '+tweets.length+' tweets from '+tweets[0].id+' to '+tweets[tweets.length-1].id+' since '+since_id);
        since_id = tweets[0].id;
        saveTweets(tweets,function(){
          console.log('Tweets were saved!');
        });
        postTweets(tweets,function(){
          console.log('Tweets were posted!');
        });
      }else{
        console.log('No new tweets were found since '+since_id);
      }
    }else{
      console.log(error);
    }
  });
};

function initialLoad(successHandler,errorHandler){

  var count=16; //3200 of tweets
  var total = 0;

  var params = {
    screen_name: 'UberFacts',
    count: 200,
  };

  var handler = function(error, tweets, response){
    if (!error){
      total += tweets.length;
      console.log('Get '+tweets.length+' tweets from '+tweets[0].id+' to '+tweets[tweets.length-1].id+'. Total: '+total);
      saveTweets(tweets,function(){
        if (count>0){
          count--;
          params.max_id = tweets[tweets.length-1].id-1;
          client.get('statuses/user_timeline.json', params,handler);
        }else{
          if (successHandler) successHandler();
        }
      });
    }else{
      console.log(error);
      if (errorHandler) errorHandler(error);
    }
  };
  client.get('statuses/user_timeline.json',params,handler);
}

function saveTweets(tweets,successHandler,errorHandler){
  MongoClient.connect(process.env.MONGO_URL, function(err, db) {
    if(err) {
      console.log(err);
      if (errorHandler) errorHandler(err);
    }
    var collection = db.collection('tweets');
    var index = 0;
    var handler = function(err,docs){
      if (err) {
        console.log(err);
        if (errorHandler) errorHandler(err);
      }
      if (index<tweets.length-1){
        index++;
        var tweet = tweets[index];
        tweet._id = tweet.id;
        collection.save(tweet,handler);
      }else{
        db.close();
        successHandler();
      }
    };
    var tweet = tweets[index];
    tweet._id = tweet.id;
    collection.save(tweet,handler);
  });
}

function postTweets(tweets,successHandler,errorHandler){
  var index = 0;
  var handler = function(err,res){
    if (!err){
      console.log('Post tweet: ',res.text[0]);
      client.post('statuses/update.json', {status: res.text[0]},  function(error, tweet, response){
        if(error) {
          console.log('Post tweet error: ',error);
          if (errorHandler) errorHandler(error);
        }else{
          if (index < tweets.length-1){
            index++;
            translate(tweets[index].text, { to: 'ru', key: process.env.YANDEX_TRANSLATE_API_KEY },handler);
          }else{
            if (successHandler) successHandler();
          }
        }
      });
    }else{
      console.log(err);
      if (errorHandler) errorHandler();
    }
  };

  translate(tweets[index].text, { to: 'ru', key: process.env.YANDEX_TRANSLATE_API_KEY }, handler);
}
