var Twitter = require('twitter');
var MongoClient = require('mongodb').MongoClient;
var translate = require('yandex-translate');

var client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

initialLoad();

function initialLoad(successHandler,errorHandler){

  var count=16; //3200 of tweets
  var total = 0;

  var params = {
    screen_name: 'UberFacts',
    count: 200,
    include_rts: false,
    exclude_replies: true
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
        translate(tweet.text, { to: 'ru', key: process.env.YANDEX_TRANSLATE_API_KEY }, function(err, res){
          if (!err){
            tweet.text_ru = res.text[0];
          }else{
            console.log('Translation server error: ',err);
          }
          collection.save(tweet,handler);
        });
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
