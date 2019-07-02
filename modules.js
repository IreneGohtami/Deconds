var getNumOfDocs = function (collectionName, url, MongoClient) {
    MongoClient.connect(url, function (error, db){
		db.collection(collectionName).count({}, function(error, numOfDocs){
            if(error) return 0;
            db.close();
        });
    }); 
} 

/*var sayGoodbye = function() {
    console.log('Goodbye!');
}*/

exports.getNumOfDocs = getNumOfDocs;
//exports.sayGoodbye = sayGoodbye;