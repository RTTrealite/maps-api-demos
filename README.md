# EagleView Australia API Demos
This is a small app that demonstrates using [leafletjs](http://leafletjs.com/) to connect to the EagleView Australia API Gateway. The example demonstrates connecting using both API Key and Client Credential Key methods. For more information about these methods, please see the [EagleView Australia API docs](https://apidocs.au.eagleview.com/#authentication-options).

# Project Setup
The code is in 2 main sections.
- **Client**: Contains a small React application with a leaflet client. You can choose between getting tiles using either an API Key or [Client Credentials](https://www.oauth.com/oauth2-servers/access-tokens/client-credentials/).
- **Server**: Contains a small Express application which, using your client credentials, requests a short-lived token from EagleView Australia which can then be served to clients.

## Setting up the keys
Ones you have obtained the keys you want from the [EagleView Australia Account Portal](https://account.au.eagleview.com/account#/apps), you will need to add them to this demo app.

### API Key
Using an API key provides quick, simple integration with EagleView Australia, at the cost of looser security. This may be appropriate in scenarios where an IP restriction can be added (e.g., running an application on an intranet with a limited pool of public IPs), or for quick prototyping work. It is added directly into the client. Open up `server/server.ts` and set the `apiKey` property to be your API Key.
![Set API Key](/docs/set_api_key.png)

### Client Credentials
The client credentials option is more secure, as it requires both an ID and Secret to retrieve a token. Generally, you'd want to secure access to your own token endpoint by authenticating your own users. Once they are authenticated, you can provide them access to your EagleView Australia token. This demo app shows a node server which will use the client credentials to get a short lived token, and then return that to the authenticated user. To setup your client credential information in this demo, open up `server/server.ts` and setup your client id and secret.

**IMPORTANT:** This is just a demo app, so for ease of use the client secret is located in code so you can see it working. But for security reasons you shouldn't check-in secrets into your source repository, or have it recorded in plain text when deployed to a server. You should treat this secret like a password and access it securely depending on your implementation.

![Set Client Credentials Key](/docs/set_client_creds_key.png)

## Install the required packages
To install the required dependencies, run the following command:
```
yarn
```

Or if you don't use yarn, then you can install the dependencies using npm: 
```
npm install
```

## Go!
After following the steps above, you should be ready to go. The project is setup to run both the server and client at the same time, so all you need to do to build and run the app is type: 
```
yarn dev
```

Or using npm: 
```
npm run dev
```

# API Key

There isn't much too this really given there is no secret involved. You just tell leaflet about the EagleView Australia imagery URL with the API key embedded, and you are good to go. You will need to ensure that you have your localhost setup as an allowed referrer for your API Key in the portal. You can find the URL when you start this demo project. The server will always start on port 9090, the client (the one you need) could change.
![Referrer URL](/docs/referrer.png)

However this simplicity comes at the cost of security. Everyone who loads your application can see the API Key and theoretically also use it. We give you the tools to restrict access to your API key by restricting access to them to particular referrers and optionally, IP address ranges. It is your responsibility to protect your API key appropriately; if you can't, it is worth considering whether the client credentials approach is more appropriate. If your API Key is misused, the only way to stop it would be to revoke the key and create a new one.

# Client Credentials Key

A Client Credentials Key is the recommended approach, as it allows you to hide your key details behind a server, then use those details to provide short lived tokens to users that you authorise as having access. If one of these short lived tokens are compromised, it will expire within the hour, and users need to re-authenticate with your server again to get a new one.

## Server Implementation

It looks like there is a bit going on here, but this all boils down to a few steps:
1. Not shown in this demo app, but firstly you should authenticate the user and ensure they are authorised (according to your rules) to get a token to call the EagleView Australia API
1. Check to see if we have a token which hasn't expired
1. If we don't, grab a write lock (as we only need one token)
1. Go grab the token from EagleView Australia login server using your client credentials key
1. Store it and return it to your user.

There are other things not shown in this demo that you should also consider:
### Storing Client Secret
The code just has the client secret stored in a variable for demo purposes. However you should treat it as a password, which means you shouldn't check it in to your source repository or store it as plain text. You should secure it the same as you are with other passwords depending on the technology stack you are using.

### Different Scopes
This example shows getting a token with only the api:imagery scope. However if you want to allow various scopes, it would be better to store multiple tokens depending on the scope and have the client send through what scopes they need. You would then authorise that the user (according to you) is allowed to have the scopes they have requested, and if so provide them the token that grants them the scopes they want. You shouldn't go down the path of creating one token with all scopes to give out.

For example, you may have user 'Admin', who requires access to api:imagery and api:account. They would get token A with those scopes. A second user 'Clerk', shouldn't get access to any of the account management APIs. If they requested a token with that scope, they should be denied, and only be able to access token B which only has the api:imagery scope, that way if they try and call the Account API they will receive a 401 Unauthorised error.

## Client Implementation

Most of the client implementation is the same between API Key and Client Credentials (i.e. create the leaflet app, register a layer etc.). Even the URL is very similar, instead of passing an api_key parameter, you pass an access_token parameter. And you don't know the API key ahead of time, you need to make a request to your server to get a token. The only other note to make about this is that we get the expiry time of the current token in seconds, so we register a timeout to be called when the token expires to go and grab a new one.

# Composite Product Selector

There is a date selector which demos how to get all the available imagery sets for a particular area. Most of the work is done in the imagery set service on the server side.

## Demo bounds

We are limiting the composite products displayed to be those that cover Perth, and therefore have locked the map to show the region around Perth. There are further considerations when implementing this over a larger area, such as checking if these products still cover the users current view, which are explained in more detail in the clients section.

## Server implementation

All the work for retrieving the available dates is done in compositeProductService.ts. There are a few important steps:
1. In the call to getCompositeProducts, we are caching the results. There is actually a bit of work retrieving all the required information (which in this demo we have reduced by just looking at Perth), so once you have it you would want to cache this for a certain amount of time and share it amongst your clients.
1. The getAllCompositeProducts function makes the initial call to get summary information about all composite products.
1. The composite products retrieved in the call above has the bounds that the composite product applies to. In filterToPerthOnly, we check that the bounds of the composite product contains Perth. Notice that in this demo we are only looking at constraintType === 'Only'. This is because these composite products likely only have the bounds set to just the area captured in the survey and no more, as it will have only imagery taken on that day. constraintType === 'UpTo' would have the bounds of all composite products taken up to that date, which would be pretty much Australia (which isn't what we are going for in the demo).
1. Once we have this filtered list of composite products, we get the more detailed bounds information about that composite product. This is a multi-polygon containing the bounds of the actual imagery. Although we aren't using it in this demo, this information is more useful in the client as explained below.

## Client implementation

The goal in the client would be to display to the user a list of the composite products that are applicable to the location the user is currently viewing on the map.

1. Best is probably the best place to start. It will show the user the best imagery for their given location, and automatically choose this as the user scrolls around.
1. Given the composite product information from the server, with the detailed actual bounds of the composite product, you would check which ones contain the users location, and display that as an option. Note: the demo doesn't do this, as it is locked to Perth and has already been filtered on the server to contain only composite products applicable there.
1. As the user scrolls around, you would need to check again what composite products match the location. You should limit the amount of times this is done per second so that it doesn't become a performance overhead.

# Other Considerations

## HTTP 429: Rate limiting

Depending on your plan, there is a limit on the number of calls you can make to the API in a given time period. If you exceed that rate limit, then you will start to get HTTP 429 errors. You should consider how you want to handle this. Below are some possible options to explore:
1. Upgrade your plan to one that includes more throughput.
1. Do nothing. It means by default, if a client experiences a 429 while retrieving tiles, they will end up with a missing tile that will only appear if they scroll away and go back.
1. Add a retry mechanism. Leaflet does have a callback for when tile errors occur, however you don't get told what the actual error code was that caused the tile to fail. You would only want to retry on certain errors (such as 429, or network errors) and not on other errors which won't be resolved just be retrying (such as 404 or 401), as that would cause additional calls to the API that count against your limit for no purpose. Another approach might be to extend the leaflet create tile function, to load tiles via AJAX calls, so that if it does fire you know the error code.

# A note on Leaflet

Leaflet is a nice mapping tool, however there is a bug that you may notice. At certain zoom levels, a faint grid like structure may appear. These are gaps between tiles, you can see more about the issue in [this leaflet bug](https://github.com/Leaflet/Leaflet/issues/3575).
![Leaflet bug](/docs/leaflet_bug.png)