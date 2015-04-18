var SpotifyWebApi = require('spotify-web-api-node');

// credentials are optional
var spotifyApi = new SpotifyWebApi({
  clientId : '8e6b936117814bcebd731391536e6c47', // Your client id
  clientSecret : '382289eb9d1d47bfbed4f97aa8723a88', // Your client secret
  redirectUri : 'http://localhost:8888/callback' // Your redirect uri
});

// Get Elvis' albums
spotifyApi.getArtistAlbums('43ZHCT0cAZBISjO8DG9PnE')
  .then(function(data) {
    console.log('Artist albums', data.body);
  }, function(err) {
    console.error(err);
  });
