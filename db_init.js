var Twitter = require('twitter');
var MongoClient = require('mongodb').MongoClient;
var translate = require('yandex-translate');
var Q = require('q');

var client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

function loadAccounts(accounts){
  if (accounts && accounts.length>0){
    var acc = accounts.shift();
    resetCollection(acc).done(function(){
      initialLoad(acc).done(function(){
        loadAccounts(accounts);
      });  
    });
  }else{
    console.log('Accounts were loaded.')
  }
};

loadAccounts(['5faktov','best_fact','hot_fact','factroom']);

function initialLoad(account,successHandler,errorHandler){
  var d = Q.defer();
  var count=16; //3200 of tweets
  var total = 0;

  var params = {
    screen_name: account,
    count: 200,
    include_rts: false,
    exclude_replies: true
  };

  var handler = function(error, tweets, response){
    if (!error){
      total += tweets.length;
      console.log('Get '+tweets.length+' tweets from '+tweets[0].id_str+' to '+tweets[tweets.length-1].id_str+'. Total: '+total);
      saveTweets(account,tweets,function(){
        if (count>0){
          count--;
          params.max_id = tweets[tweets.length-1].id_str;
          client.get('statuses/user_timeline.json', params,handler);
        }else{
          if (successHandler) {
            successHandler();
          }
          d.resolve();              
        }
      });
    }else{
      console.log(error);
      if (errorHandler) {
        errorHandler(error);
      }
      d.resolve();
    }
  };
  console.log('Get tweets for account @'+account);
  client.get('statuses/user_timeline.json',params,handler);
  return d.promise;
}

function resetCollection(collection){
  var d = Q.defer();
  MongoClient.connect(process.env.MONGO_URL, function(err, db) {
    if(err) {
      console.log(err);
      d.reject();
    }else{
      db.dropCollection(collection,function(err){
        if (err){
          console.log(err);
          d.reject();
        }else{
          console.log('Collection ['+collection+'] was cleared.');
          d.resolve();
        }
      });
    }
  });
  return d.promise;
}

function saveTweets(account,tweets,successHandler,errorHandler){
  MongoClient.connect(process.env.MONGO_URL, function(err, db) {
    if(err) {
      console.log(err);
      if (errorHandler) errorHandler(err);
    }
    var collection = db.collection(account);
    var index = 0;
    var handler = function(err,docs){
      if (err) {
        console.log(err);
        if (errorHandler) errorHandler(err);
      }
      if (index<tweets.length-1){
        index++;
        var tweet = tweets[index];
        tweet._id = tweet.id_str;
        tweet.status = 'N';
        //tweet.text = tweet.text.replace(/(\r\n|\n|\r)/gm," ").replace(/\s+/," ");
        collection.save(tweet,handler);
        /*
        translate(tweet.text, { to: 'ru', key: process.env.YANDEX_TRANSLATE_API_KEY }, function(err, res){
          if (!err){
            tweet.text_ru = res.text[0];
          }else{
            console.log('Translation server error: ',err);
          }
          collection.save(tweet,handler);
        });
        */
      }else{
        db.close();
        successHandler();
      }
    };
    var tweet = tweets[index];
    tweet._id = tweet.id_str;
    collection.save(tweet,handler);
  });
}
