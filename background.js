var version = '1.0';
const epoch = new Date().getTime();
let offset = 0;
var debuggersId = [];
var logsByTab = {};
var report={};
const CONSOLE_LEVELS = ['error'];
const NETWORK_LEVEL = 400;
const getScheletonReport = () => ({
  log: {
    version: '1.2',
    creator: {
      name: 'logTracker',
      version: 0.1
    },
    pages: [
      {
        startedDateTime: new Date().toISOString(),
        id: 'page_1',
        title: '',
        pageTimings: {
          onContentLoad: 0,
          onLoad: 0
        }
      }
    ],
    entries: []
  }
});

const URLToArray = url => {
  var request = [];
  var pairs = url.substring(url.indexOf('?') + 1).split('&');
  for (var i = 0; i < pairs.length; i++) {
    if (!pairs[i]) continue;
    var pair = pairs[i].split('=');
    request.push({
      name: decodeURIComponent(pair[0]),
      value: decodeURIComponent(pair[1])
    });
  }
  return request;
};

const mapEntry = ({ request, response }) => ({
  startedDateTime: new Date(epoch + request.timestamp).toISOString(),
  time: response.timestamp - request.timestamp,
  request: {
    method: request.method,
    url: request.url,
    httpVersion: response.protocol,
    cookies: [],
    headers: Object.keys(request.headers).map(key => ({
      name: key,
      value: request.headers[key]
    })),
    queryString: request.url.indexOf('?') > -1 ? URLToArray(request.url) : [],
    headersSize: 50,
    bodySize: -1,
    postData: {
      mimeType: request.headers['Content-Type'],
      text: request.postData,
      params: request.postData ? URLToArray(request.postData) : undefined
    }
  },
  response: {
    status: response.status,
    statusText: response.statusText,
    httpVersion: response.protocol,
    cookies: [],
    headers: Object.keys(response.headers).map(key => ({
      name: key,
      value: response.headers[key]
    })),
    content: {
      size: response.encodedDataLength,
      mimeType: response.mimeType,
      text: response.statusText + '\n\n' + response.headersText
    },
    headersSize: 50,
    redirectURL: '',
    bodySize: response.encodedDataLength
  },
  cache: {},
  timings: {
    dns: response.dnsEnd - response.dnsStart,
    connect: response.connectEnd - response.connectStart,
    blocked: 0,
    send: request.sendEnd - response.sendStart,
    wait: response.requestTime,
    receive: response.receiveHeadersEnd
  }
});

const handleConsoleMessage = (tabId, message) => {
  if (CONSOLE_LEVELS.indexOf(message.level) > -1) {
    const log = logsByTab[tabId];
    log.console.push(message);
    logsByTab[tabId] = log;
  }
};

const handleRequestWillBeSent = (tabId, params) => {
  const log = logsByTab[tabId];
  log.network[params.requestId] = {};
  log.network[params.requestId].request = Object.assign({}, params.request, {
    timestamp: params.timestamp
  });
};

const handleResponseReceived = (tabId, params) => {
  const log = logsByTab[tabId];
  log.network[params.requestId].response = Object.assign({}, params.response, {
    timestamp: params.timestamp
  });
};

const handleNetworkMessage = (tabId, message, params) => {
  if (message == 'Network.requestWillBeSent') {
    handleRequestWillBeSent(tabId, params);
  } else if (message == 'Network.responseReceived') {
    handleResponseReceived(tabId, params);
  }
};

const onDebugEvent = (debuggeeId, message, params) => {
  // only 1 event for console
  debugger;
  if (message === 'Console.messageAdded') {
    handleConsoleMessage(debuggeeId.tabId, params.message);
  } else {
    handleNetworkMessage(debuggeeId.tabId, message, params);
  }
};

const onDebuggerAttach = tabId => {
  chrome.browserAction.setIcon({ path: 'icon.red.png' });
  logsByTab[tabId] = {
    console: [],
    network: {}
  };
  debuggersId.push(tabId);
  chrome.debugger.sendCommand(
    {
      tabId: tabId
    },
    'Network.enable'
  );
  chrome.debugger.sendCommand(
    {
      tabId: tabId
    },
    'Console.enable'
  );
  chrome.debugger.onEvent.addListener(onDebugEvent);
};

const downloadReport = (data, filename, type) => {
  const blob = new Blob([data], {
    type
  });
  const e = document.createEvent('MouseEvents');
  const a = document.createElement('a');
  a.download = filename;
  a.href = window.URL.createObjectURL(blob);
  a.dataset.downloadurl = [type, a.download, a.href].join(':');
  e.initMouseEvent(
    'click',
    true,
    false,
    window,
    0,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    false,
    0,
    null
  );
  a.dispatchEvent(e);
  
};

const downloadConsoleReport = tabId => {
  if (logsByTab[tabId].console.length === 0) {
    return; // do not download empty content
  }
  let consoleData = '"LEVEL","MESSAGE","SOURCE"\n \n';
  logsByTab[tabId].console.forEach(element => {
    consoleData += `"${element.level}","${element.text}","${element.url}"\n`;
  });
  downloadReport(consoleData, `console.${new Date().toISOString()}.csv`, 'csv');
};

const downloadHARReport = tabId => {
  // alert("xxxx");
  const keys = Object.keys(logsByTab[tabId].network);
  report = getScheletonReport();
  keys.forEach(key => {
    const element = logsByTab[tabId].network[key];
    // if (element.response && element.response.status >= NETWORK_LEVEL) {//element.request.method==='POST' 
    if ((element.response.status === 404 || element.response.status === 500) && element.request.url.indexOf('logisticsteam') !== -1) {
      alert("url: "+ element.request.url + ";\n" + 
            "method: "+ element.request.method + ";\n" + 
            "error: "+ element.response.status + ";\n" +    
            "queryString: "+ element.request.queryString + ";\n" + 
            "postData: "+ element.request.postData + ";\n" +
            "response: "+ element.response.content + ";\n"
            )
      report.log.entries.push(mapEntry(element));
    }
  });
  if (report.log.entries.length === 0) {
    return; // do not download empty content
  }
  var filename=`network.${new Date().toISOString()}.har`;
  downloadReport(
    JSON.stringify(report, undefined, 2),
    filename,
    'har'
  );

   var postData=JSON.stringify(report, undefined, 2);
  //  var sendemail='var $=window.$;$.ajax({type: "POST",url: "https://127.0.0.1:2222/test/sendEmail",data:'+postData+',processData: true,success: function(response){console.log(response);}});'

  // chrome.tabs.executeScript(tabId, {file: "jquery.min.js", allFrames: true},function(){
  //   chrome.tabs.executeScript(tabId, {code: sendemail, allFrames: false});
  //   });     
};

const onDebuggerDetach = (tab, reason) => {
  chrome.browserAction.setIcon({ path: 'icon.green.png' });
  const tabId = typeof tab === 'number' ? tab : tab.tabId;
  debuggersId = debuggersId.filter(el => el !== tabId);
  if (reason !== chrome.debugger.DetachReason.CANCELED_BY_USER) {
    downloadConsoleReport(tabId);
    downloadHARReport(tabId);
  
  }
  chrome.debugger.sendCommand(
    {
      tabId: tabId
    },
    'Network.disable'
  );
  chrome.debugger.sendCommand(
    {
      tabId: tabId
    },
    'Console.disable'
  );
  logsByTab[tabId] = undefined;
};

const onUserAction = tab => {
  if (!logsByTab[tab.id]) {
    chrome.debugger.attach(
      {
        tabId: tab.id
      },
      version,
      onDebuggerAttach.bind(null, tab.id)
    );
  } else {
    chrome.debugger.detach(
      {
        tabId: tab.id
      },
      onDebuggerDetach.bind(null, tab.id)
    );
  }
};


// register events
console.log("ad");
chrome.browserAction.onClicked.addListener(onUserAction);
// chrome.devtools.network.onRequestFinished.addListener(onDebuggerDetach);
chrome.debugger.onDetach.addListener(onDebuggerDetach);

// var Upload = function (file) {
//     this.file = file;
// };

// Upload.prototype.getType = function() {
//     return this.file.type;
// };
// Upload.prototype.getSize = function() {
//     return this.file.size;
// };
// Upload.prototype.getName = function() {
//     return this.file.name;
// };
// Upload.prototype.doUpload = function () {
//     var that = this;
//     var formData = new FormData();

//     // add assoc key values, this will be posts values
//     formData.append("file", this.file, this.getName());
//     formData.append("upload_file", true);

//     $.ajax({
//         type: "POST",
//         url: "script",
//         xhr: function () {
//             var myXhr = $.ajaxSettings.xhr();
//             if (myXhr.upload) {
//                 myXhr.upload.addEventListener('progress', that.progressHandling, false);
//             }
//             return myXhr;
//         },
//         success: function (data) {
//             // your callback here
//         },
//         error: function (error) {
//             // handle error
//             console.log(error);
//         },
//         async: false,
//         data: formData,
//         cache: false,
//         contentType: false,
//         processData: false,
//         timeout: 60000
//     });
// };