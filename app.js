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

var since_id = process.env.SINCE_ID;

var publishJob = schedule.scheduleJob({}, publishTweet);
var subscribeJob = schedule.scheduleJob({}, getResentTweets);

function publishTweet(){
  console.log('It\'s time to publish new tweet');
  MongoClient.connect(process.env.MONGO_URL, function(err, db) {
    if (!err){
      var tweets = db.collection('tweets');
      tweets.findOne({status:'FOR_PUBLISH'},{sort:[['id','asc']]},function(err,tweet){
        if (!err){
          if (tweet){
            console.log('Tweet '+tweet.id+' was choosen for publish');
            client.post('statuses/update.json', {status: tweet.text_ru},  function(err, t, response){
              if (!err){
                console.log('Tweet '+tweet.id+' was published: ',tweet.text_ru);
                tweet.status='PUBLISHED';
                tweet.published_at = new Date().getTime();
                tweets.save(tweet,function(err){
                  if (!err) {
                    console.log('Tweet '+tweet.id+' was marked as published');
                  }else{
                    console.log('Can\'t update tweet '+tweet.id+': ',err);
                  }
                  db.close();
                });
              }else{
                console.log('Can\'t post tweet '+tweet.id+': ',err);
                db.close();
              }
            });
          }else{
            console.log('Can\'t find any tweet for publish');
            db.close();
          }
        }else{
          console.log(err);
          db.close();
        }
      });
    }else{
      console.log(err);
    }
  });
}

function getResentTweets(){
  console.log('It\'s time to check for new tweets');

  var params = {
    screen_name: 'UberFacts',
    count: 200,
    include_rts: false,
    exclude_replies: true,
    since_id: since_id
  };

  var saveTweets = function(tweets){
    MongoClient.connect(process.env.MONGO_URL, function(err, db) {
      if(!err) {
        var collection = db.collection('tweets');
        tweets.forEach(function(tweet){
          tweet._id = tweet.id;
          translate(tweet.text, { to: 'ru', key: process.env.YANDEX_TRANSLATE_API_KEY }, function(err, res){
            if (!err){
              tweet.text_ru = res.text[0];
            }else{
              console.log('Translation server error: ',err);
            }
            collection.save(tweet,function(err){
              if (!err) {
                console.log('Tweet '+tweet.id+' was saved');
              }else{
                console.log('Can\'t save tweet '+tweet.id+': ',err);
              }
            });
          });
        });
      }else{
        console.log(err);
      }
    });
  };

  client.get('statuses/user_timeline.json',params,function(err, tweets, response){
    if (!err){
      if (tweets.length>0 && tweets[tweets.length-1].id===since_id){
        tweets.pop();
      }
      if (tweets.length > 0){
        console.log(tweets.length+' tweets from '+tweets[0].id+' to '+tweets[tweets.length-1].id+' where found since '+since_id);
        since_id = tweets[0].id;
        console.log('Update "since" value to ',since_id);
        saveTweets(tweets);
      }else{
        console.log('No new tweets were found since ',since_id);
      }
    }else{
      console.log(err);
    }
  });
};
