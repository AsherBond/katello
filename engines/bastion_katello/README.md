# Bastion: The Katello UI Engine #

Bastion is a single page AngularJS based web client for the Katello server. This means that all Bastion "pages" are served from a single static page without the need for a round trip to the server.
All URLs are relative to the application root, `/content-hosts` and `/content_views`, for example, are able to be bookmarked, and work with the browser's back button.
The only real difference, as far as the user is concerned, is that the application is much quicker between Bastion "page loads" since only the HTML needed to render the next page is loaded instead of the entire page.

# Running tests:

```
sudo dnf -y install epel-release epel-next-release
sudo dnf -y install npm chromium-headless chromium
cd ./engines/bastion_katello
sudo npm install -g bower
sudo npm install -g grunt-cli
npm install
cd ../bastion
npm install
```

```
grunt ci
```


## Contributing ##
We welcome contributions, please see the Bastion [developer guide](https://github.com/Katello/bastion/blob/master/README.md).
