var Twitter = require('twitter');
var schedule = require('node-schedule');
var MongoClient = require('mongodb').MongoClient;
var translate = require('yandex-translate');
var Q = require('q');

var client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

//var publishJob = schedule.scheduleJob({}, publishTweet);
//var subscribeJob = schedule.scheduleJob({}, getResentTweets);


publishTweet().done(getResentTweets);

if (process.env.DELAY_SEC){
  console.log('Schedule next execution after '+process.env.DELAY_SEC+' seconds');
  setTimeout(publishTweet,process.env.DELAY_SEC*1000);
  setTimeout(getResentTweets,process.env.DELAY_SEC*1000);
}


function publishTweet(){
  var d = Q.defer();
  console.log('It\'s time to publish new tweet');
  MongoClient.connect(process.env.MONGO_URL, function(err, db) {
    if (!err){
      var tweets = db.collection('tweets');
      tweets.findOne({status:'R'},{sort:[['_id','asc']]},function(err,tweet){
        if (!err){
          if (tweet){
            console.log('Tweet '+tweet.id_str+' was choosen for publish');
            client.post('statuses/update.json', {status: tweet.text_ru.substring(0,140)},  function(err, t, response){
              if (!err){
                console.log('Tweet '+tweet.id_str+' was published: ',tweet.text_ru);
                tweet.status='P';
                tweet.published_at = new Date().getTime();
                tweets.save(tweet,function(err){
                  if (!err) {
                    console.log('Tweet '+tweet.id_str+' was marked as published');
                  }else{
                    console.log('Can\'t update tweet '+tweet.id_str+': ',err);
                  }
                  db.close();
                  d.resolve();
                });
              }else{
                console.log('Can\'t post tweet '+tweet.id_str+': ',err);
                db.close();
                d.resolve();
              }
            });
          }else{
            console.log('Can\'t find any tweet for publish');
            db.close();
            d.resolve();
          }
        }else{
          console.log(err);
          db.close();
          d.resolve();
        }
      });
    }else{
      console.log(err);
      d.resolve();
    }
  });
  return d.promise;
}

function getResentTweets(){
  console.log('It\'s time to check for new tweets');

  var saveTweets = function(tweets){
    MongoClient.connect(process.env.MONGO_URL, function(err, db) {
      if(!err) {
        var collection = db.collection('tweets');
        var promises = [];
        tweets.forEach(function(tweet){
          var d = Q.defer();
          tweet._id = tweet.id_str;
          tweet.status='N';
          translate(tweet.text, { to: 'ru', key: process.env.YANDEX_TRANSLATE_API_KEY }, function(err, res){
            if (!err){
              tweet.text_ru = res.text[0];
            }else{
              console.log('Translation server error: ',err);
            }
            collection.save(tweet,function(err){
              if (!err) {
                console.log('Tweet '+tweet.id_str+' was saved');
              }else{
                console.log('Can\'t save tweet '+tweet.id_str+': ',err);
              }
              d.resolve();
            });
          });
          promises.push(d.promise);
        });
        Q.all(promises).done(function(){
          db.close();
        });
      }else{
        console.log(err);
      }
    });
  };

  MongoClient.connect(process.env.MONGO_URL, function(err, db) {
    var collection = db.collection('tweets');
    collection.findOne({},{sort:[["id","desc"]]},function(err,tweet){
      var since_id;
      if (!err){
        if (tweet){
          since_id = tweet.id_str;
          console.log('Set "since_id" to ',since_id);
        }else{
          console.log('Cant find any tweet in database. Set "since_id" to "undefined".');
        }
      }else{
        console.log('Cant find any tweet in database due to error: ',err);
      }

      db.close();

      var params = {
        screen_name: 'UberFacts',
        count: 200,
        include_rts: false,
        exclude_replies: true,
        since_id: since_id
      };

      client.get('statuses/user_timeline.json',params,function(err, tweets, response){
        if (!err){
          if (tweets.length>0 && tweets[tweets.length-1].id_str===since_id){
            tweets.pop();
          }
          if (tweets.length > 0){
            console.log(tweets.length+' tweets from '+tweets[0].id_str+' to '+tweets[tweets.length-1].id_str+' where found since '+since_id);
            //since_id = tweets[0].id_str;
            //console.log('Update "since" value to ',since_id);
            saveTweets(tweets);
          }else{
            console.log('No new tweets were found since ',since_id);
          }
        }else{
          console.log(err);
        }
      });
    });
  });

};
