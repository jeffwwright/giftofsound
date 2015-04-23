var express        =        require('express'); // Express web server framework
var request        =        require('request'); // "Request" library
var querystring    =        require('querystring');
var cookieParser   =        require('cookie-parser');
var SpotifyWebApi  =        require('spotify-web-api-node');
var ig             =        require('instagram-node').instagram();
var parseString    =        require('xml2js');//.parseString;
var bodyParser     =        require('body-parser');
var jstoxml        =        require('jstoxml');

var parser = new parseString.Parser();

// Every call to `ig.use()` overrides the `client_id/client_secret`
// or `access_token` previously entered if they exist.
ig.use({ access_token: 'YOUR_ACCESS_TOKEN' });
ig.use({ client_id: '15ab281ad82d4b2a85c1677085d6fff6',
client_secret: 'a25d44c826f0427ebc3c4c0a24663d17' });

var client_id = '8e6b936117814bcebd731391536e6c47'; // Your client id
var client_secret = '382289eb9d1d47bfbed4f97aa8723a88'; // Your client secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri
var stateKey = 'spotify_auth_state';
var stStateKey = 'soundtouch_auth_state';

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var app = express();

app.use(express.static(__dirname + '/public'))
    .use(cookieParser())
    .use(bodyParser.urlencoded({ extended:false }));

// Instagram Login
app.get('/instagramlogin', function(req, res) {

});

// Redeem Gift
app.get('/receive', function(req, res) {
  res.redirect('/receive.html');
});

// SoundTouch Get Account Data
app.get('/soundtouchaccount', function(req, res) {
  // Proceed if ID and Auth token are provided
  var stId = req.query.stId;// || null;
  var authToken = req.query.authToken;// || null;
  var devId;

  if (stId !== null && authToken !== null ) {
    var requestData = {
      url: 'https://streaming.bose.com/streaming/account/' + stId + '/devices',
      headers: {
        'Accept': 'application/vnd.bose.streaming-v1.0+xml',
        'Content-Type': 'application/vnd.bose.streaming-v1.0+xml',
        'Authorization': authToken
      }
    };

    request.get(requestData, function( error, response, body ) {
      parser.parseString(body, function( err, result ) {
        devId = result['devices']['device'][0]['$'].deviceid;
      });
    });

    if ( devId !== null ) {
      var preset1 = null;
      var preset2 = null;
      var preset3 = null;
      var preset4 = null;
      var preset5 = null;
      var preset6 = null;

      console.log('requesting presets...');

      requestData = {
        url: 'https://streaming.bose.com/streaming/account/' + stId + '/device/' + devId + '/presets',
        headers: {
          'Accept': 'application/vnd.bose.streaming-v1.0+xml',
          'Content-Type': 'application/vnd.bose.streaming-v1.0+xml',
          'Authorization': authToken
        }
      };

      request.get(requestData, function( error, response, body ) {
        parser.parseString(body, function( err, result ) {
          var presets = result['presets']['preset'];
          console.log(presets[0]['name'][0]);
          preset1 = presets[0]['name'][0];
          preset2 = presets[1]['name'][0];
          preset3 = presets[2]['name'][0];
          preset4 = presets[3]['name'][0];
          preset5 = presets[4]['name'][0];
          preset6 = presets[5]['name'][0];

          res.redirect('/receive#' +
            querystring.stringify({
              preset1: preset1,
              preset2: preset2,
              preset3: preset3,
              preset4: preset4,
              preset5: preset5,
              preset6: preset6
            })
          );
        });
      });
    } else {
      res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
    }
  } else {
      res.redirect('/#' +
        querystring.stringify({
          error: 'state_mismatch'
        })
      );
    }
  });

// SoundTouch Login
app.post('/soundtouchlogin', function(req, res) {
  var username = req.body.username;
  var password = req.body.userpass;

  var body = jstoxml.toXML({
    login: {
      username: username,
      password: password
    }
  }, {
    header: true, indent: '   '
  });

  var postRequest = {
    //url: 'https://streaming.bose.com/streaming/account/login',
    url: 'http://streaming.bose.com/streaming/account/login',
    headers: {
      'Accept': 'application/vnd.bose.streaming-v1.0+xml',
      'Content-Type': 'application/vnd.bose.streaming-v1.0+xml'
    },
    body: body
  };

  request.post(postRequest, function(error, response, body) {
    var stId = null;
    var authToken = null;

    if (!error && response.statusCode === 200) {
      parser.parseString(body, function(err, result) {
        stId = result['account']['$'].id;
        authToken = response.headers['credentials'];
        console.log('stId: ' + stId + ' authTokenL: ' + authToken );
      });

      res.redirect('/receive#' +
        querystring.stringify({
          stId: stId,
          authToken: authToken
        })
      );
    } else {
        // we can also pass the token to the browser to make requests from there
        console.log(error);
        res.redirect('/receive#' +
          querystring.stringify({
            error: 'invalid_token'
          })
        );
    }
  });
});

// Spotify Login
app.get('/spotifylogin', function(req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email playlist-read-private';
  res.redirect('https://accounts.spotify.com/authorize?' +
  querystring.stringify({
    response_type: 'code',
    client_id: client_id,
    scope: scope,
    redirect_uri: redirect_uri,
    state: state
  }));
});

// Callback Function
app.get('/callback', function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
    querystring.stringify({
      error: 'state_mismatch'
    }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
        refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
        querystring.stringify({
          access_token: access_token,
          refresh_token: refresh_token
        }));
      } else {
        res.redirect('/#' +
        querystring.stringify({
          error: 'invalid_token'
        }));
      }
    });
  }
});

// Get Spotify Playlists
app.get('/tracks', function (req, res) {
  var code = req.query.access_token || null;
  console.log("code: " + code);

  if (code === null ) {
    res.redirect('/#' +
    querystring.stringify({
      error: 'state_mismatch'
    }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    var options = {
      url: 'https://api.spotify.com/v1/users/jeffwwright/playlists',
      headers: {
        'Authorization': 'Bearer ' + code
      },
      json: true
    };

    // use the access token to access the Spotify Web API
    request.get(options, function(error, response, body) {
      console.log("sc2: " + response.statusCode);
      console.log(body);
    });

    // we can also pass the token to the browser to make requests from there
    res.redirect('/#' );
  }
});

app.get('/refresh_token', function(req, res) {
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);
