function senddata(){
  console.log('yeah2');
  
  var postData = JSON.stringify({
    "key": "test2"
});   
var $=window.$;
   $.ajax({
        type: "POST",
        headers: {
    'Content-Type': 'application/json'
  },
        url: "https://127.0.0.1:2222/test/sendEmail",
        contentType: "application/json",
        data: postData,
        dataType: "json",
        processData: false,
       success: function(response){
        console.log(response);
            }
    });
};
senddata();