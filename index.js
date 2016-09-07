var React = require('react');
// var ReactDOM = require('react-dom');
var Modal = require('react-modal');
// jQuery adds a lot to the download size
var $ = require('jQuery');
var urlUtility = require('url');

var clover = require("remote-pay-cloud");
var log = clover.Logger.create();

const customStyles = {
    content : {
        top                   : '50%',
        left                  : '50%',
        right                 : 'auto',
        bottom                : 'auto',
        marginRight           : '-50%',
        transform             : 'translate(-50%, -50%)'
    }
};

const message_normal_style = {
};

const message_error_style = {
    fontStyle: 'italic',
    color: 'red'
};

/**
 * Style object used with the server selection and the device selection
 * @type {{width: string, height: string, overflow: string, border: string}}
 */
const selectStyle = {
    width: '240px',
    height: '34px',
    overflow: 'hidden',
    border: '1px solid #ccc'
};

/**
 * A component to select a device from a list
 */
var DeviceSelect = React.createClass({
    /**
     * REACT - Invoked once before the component is mounted. The return
     * value will be used as the initial value of this.state.
     * @returns {{deviceSerialId: (*|string|string|string)}}
     */
    getInitialState: function() {
        return {deviceSerialId: this.props.deviceSerialId};
    },
    /**
     * REACT - Invoked once, both on the client and server, immediately
     * before the initial rendering occurs. If you call setState within
     * this method, render() will see the updated state and will be executed
     * only once despite the state change.
     */
    componentDidMount: function() {
        this.loadCloverDevicesFromServer();
    },

    /**
     *
     * @returns {string} the url of the service that returns the list
     * of devices.
     */
    getDeviceURL: function() {
        return this.preparedToGetDevices() ? this.endpoints.getDevicesEndpoint(this.props.merchantId) : null;
    },

    /**
     *
     * @returns {*|boolean|string|string} - true if this component has
     *  enough information to retreive devices
     */
    preparedToGetDevices: function() {
        // Ensure that values are set that will allow us to configure
        // the endpoint.  The endpoint in this case is the Clover oauth
        // configuration.
        var prepared = (this.props.url && this.props.url !== "") &&
          (this.props.merchantId && this.props.merchantId !== "") &&
          (this.props.oauthToken && this.props.oauthToken !== "");
        if(prepared) {
            var endpointConfig = new CloverOAuth2(
              {
                  "domain": this.props.url,
                  "clientId": this.props.clientId,
                  "merchantId": this.props.merchantId
              });
            // The clover oauth uses the existing url by default to redirect the user
            // After authentication.  For this app, we need to make sure we hold on to
            // the current device serial id, and pass a flag that indicates that
            // the user is in the process of configuring the device.  This is used
            // to allow the configuration GUI to appear immediately when the user is
            // redirected back to this page.
            var currentWindowUrl = urlUtility.parse(window.location.href, true);
            // Clear the hash (though it really does not matter mush)
            currentWindowUrl.hash = '';
            // query (object; see querystring) will only be used if search is absent.
            currentWindowUrl.search = '';
            // Set the flag that indicates we are in the config gui
            currentWindowUrl.query['workingOnConfig']=true;
            // If we have a deviceSerialId selected, pass it through
            currentWindowUrl.query['deviceSerialId']=this.state.deviceSerialId;
            endpointConfig.setRedirectUrl(urlUtility.format(currentWindowUrl));

            this.endpoints = new clover.Endpoints(endpointConfig);
        }
        return prepared;
    },

    /**
     * If prepared to get the device list, this will call the service to
     * load the devices.
     */
    loadCloverDevicesFromServer: function() {
        var url = this.getDeviceURL();
        if(url !== this.fullurl) {
            this.fullurl = url;
            if (url && url !== "") {
                $.ajax({
                    url: this.getDeviceURL(),
                    dataType: 'json',
                    cache: false,
                    success: this.formatDeviceList,
                    error: function (xhr, status, err) {
                        console.error(this.getDeviceURL(), status, err.toString());
                    }.bind(this)
                });
            }
        }
    },

    /**
     * Format the list of devices into a set of options and set in the components state.
     * @param devices {{elements: [ {serial: (string)}]}}
     */
    formatDeviceList: function (devices) {
        var formattedOptions = [];
        // set the default option to tell the user to select a device.
        formattedOptions.push(
          <option key="" value="">Select a device</option>
        );
        // build the list of devices
        for (var i = 0; i < devices.elements.length; i++) {
            var device = devices.elements[i];
            formattedOptions.push(
              <option key={device.serial}
                      value={device.serial}>{device.model} {device.serial}</option>
            );
        }
        // Set the devices into our state
        this.setState({options: formattedOptions}, function() {
            // If there is an existing device selected, make it the selection in the drop down.
            var valueTofind = this.props.deviceSerialId;
            var found = $('#clover-device option[value="' + valueTofind + '"]');
            if (found.length) {
                log.debug(valueTofind + " ... " + this);
                this.setSelected(valueTofind);
            }
        });
    },

    /**
     * Sets the selected device serialid into the state of the component.
     * @param value: (string)
     */
    setSelected: function(value) {
        this.setState({deviceSerialId : value});
        this.props.onDeviceSelected(value);
    },

    /**
     * React to the user changing the selection in the component
     * @param data: event
     */
    handleChange: function(data) {
        if(data.currentTarget && data.currentTarget["selectedOptions"] &&
          data.currentTarget["selectedOptions"].length > 0) {
            var selectedOption = data.currentTarget["selectedOptions"][0];
            log.debug(selectedOption["value"]);
            if(selectedOption["value"] && selectedOption["value"] !== "") {
                this.setSelected(selectedOption["value"]);
            }
        }
        log.debug(data);
    },

    /**
     * REACT - render this component
     * @returns {XML}
     */
    render:  function() {
        this.loadCloverDevicesFromServer();
        return (
          <select
            disabled={!this.state.options}
            style={selectStyle}
            id="clover-device"
            name="clover-device"
            value={this.state.deviceSerialId}
            onChange={this.handleChange}
          >
              {this.state.options}
          </select>
        );
    }
});

var CloverServerSelect = React.createClass({
    getInitialState: function() {
        return {cloverServer: ''};
    },
    componentDidMount: function() {
        this.loadCloverServers();
    },
    loadCloverServers() {
        $.ajax({
            url: this.props.url,
            dataType: 'json',
            cache: false,
            success: function(servers) {
                var formattedOptions = [];
                formattedOptions.push(
                  <option key="" value="">Select the Clover Server</option>
                );
                for (var i = 0; i < servers.elements.length; i++) {
                    var server = servers.elements[i];
                    formattedOptions.push(
                      <option key={server.id} value={server.url}>{server.url}</option>
                    );
                }
                this.setState({options: formattedOptions}, function() {
                    var referredBy = urlUtility.parse(document.referrer);
                    var valueTofind = referredBy.protocol + "//" + referredBy.host + "/";
                    var found = $('#clover-server option[value="' + valueTofind + '"]');
                    if (found.length) {
                        log.debug(valueTofind + " ... " + this);
                        this.setSelected(valueTofind);
                    } else if(this.props.cloverServer) {
                        var found = $('#clover-server option[value="' + this.props.cloverServer + '"]');
                        if (found.length) {
                            log.debug(this.props.cloverServer, this);
                            this.setSelected(this.props.cloverServer);
                        }
                    }
                });
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },
    setSelected: function(server) {
        this.setState({cloverServer: server});
        this.props.onServerSelected({cloverServer: server});
    },
    handleChange: function(data) {
        if(data.currentTarget && data.currentTarget["selectedOptions"] &&
          data.currentTarget["selectedOptions"].length > 0) {
            var selectedOption = data.currentTarget["selectedOptions"][0];
            log.debug(selectedOption["value"]);
            if(selectedOption["value"] && selectedOption["value"] !== "") {
                this.setSelected(selectedOption["value"]);
            }
        }
        log.debug(data);
    },
    render:  function() {
        return (
          <select
            style={selectStyle}
            id="clover-server"
            name="clover-server"
            value={this.state.cloverServer}
            onChange={this.handleChange}
          >
              {this.state.options}
          </select>
        );
    }
});


var ConfigureApp = React.createClass({

    getDefaultProps: function () {
        return {
            openButtonText: "Configure Clover Connector",
            deviceConnectButtonText: "Connect to Device",
            deviceDisconnectButtonText: "Disconnect from Device",
            connToDeviceEstablished: "Connection to device established. Getting merchant configuration information...",
            merchConfigRetrvd: "Merchant configuration information retrieved.",
            devConnToFrndlyId: "Connected to ",
            posConnToFrndlyId_1: "Displaying connection to ",
            posConnToFrndlyId_2: " on device.",
            posDevVerifiedCB: "Device is configured.  Select 'Close' to return to the application.",
            posCloseDev: "Closing device connection.",
            posDevDisconnected: "Device disconnected.",
            verifyCommButton: "Verify Device Communication",
            saveConfigButton: "Save configuration",
            closeButton: "Close",
            title: "Clover Device Configuration"
        }
    },

    getInitialState: function() {
        var currentWindowUrl = urlUtility.parse(window.location.href, true);
        var isWorkingOnConfig = Boolean( currentWindowUrl.query['workingOnConfig'] );
        var deviceSerialId = currentWindowUrl.query['deviceSerialId'];
        var token = currentWindowUrl.hash ? currentWindowUrl.hash.substring(1) : null;
        if(!isWorkingOnConfig) {
            this.loadConfiguration();
        }
        return {
            infoMessage: "",
            infoMessage_type: message_normal_style,
            modalIsOpen: isWorkingOnConfig,
            deviceSerialId: deviceSerialId,
            friendlyId : this.props.friendlyId,
            oauthToken : token,
            clientId : this.props.clientId, // Wil need to be entered if not the Clover app.
            remoteApplicationId: this.props.remoteApplicationId,
            cloverConnector: null,
            cloverConnector_isConnected: false,
            deviceVerified: false
        };
    },

    componentWillMount: function() {
    },

    openModal: function() {
        if(this.props.onOpen) {
            this.props.onOpen(this);
        }
        this.setState({deviceVerified: false, infoMessage: ""}, function() {
            this.setState({modalIsOpen: true});
        });
    },
    afterOpenModal: function() {
        // references are now sync'd and can be accessed.
        this.refs.subtitle.style.color = '#00f';
        this.refs.subtitle.style.fontFamily = 'sans-serif';

        this.refs.statusMessage.style.width = '366px';
        this.refs.statusMessage.style.wordWrap = 'break-word';
        this.refs.statusMessage.style.fontFamily = 'sans-serif';
        this.refs.closeButton.style.float = 'right';

        this.refs.buttonContainer.style.width = '100%';
    },
    closeModal: function() {
        if(this.state.cloverConnector != null && this.state.cloverConnector_isConnected) {
            try {
                this.state.cloverConnector.showWelcomeScreen();
            } catch(e) {
                // eat it
            }
        }
        this.setState({modalIsOpen: false});
    },

    setToken: function(token) {
        this.setState({oauthToken : token}, function() {
            var merchantId = this.cloverOAuth.getURLParams()["merchant_id"];
            if(!merchantId){
                this.cloverOAuth.redirect();
            } else {
                this.setState({merchantId: this.cloverOAuth.getURLParams()["merchant_id"]});
            }
        });
    },
    handleServerSelected: function(data) {
        // If the server changes, then we need to initialize the device select again.
        // set the url on the device select, and make it go get devices.
        log.debug(data);
        this.setState({domain : data.cloverServer}, function() {
            this.cloverOAuth = new CloverOAuth2({domain: this.state.domain, clientId: this.state.clientId});

            var currentWindowUrl = urlUtility.parse(window.location.href, true);
            currentWindowUrl.hash = '';
            // query (object; see querystring) will only be used if search is absent.
            currentWindowUrl.search = '';
            currentWindowUrl.query['workingOnConfig']=true;
            currentWindowUrl.query['deviceSerialId']=this.state.deviceSerialId;

            this.cloverOAuth.setRedirectUrl(urlUtility.format(currentWindowUrl));
            this.cloverOAuth.getAccessToken(this.setToken);
        });
    },
    handleDeviceSelected: function(data) {
        // set the url on the device select, and make it go get devices.
        log.debug(data);
        this.setState({deviceSerialId : data}, function() {
            log.debug(this.state);
        });
    },

    setNormalMessage: function(message, callback) {
        this.setState({infoMessage_type: message_normal_style, infoMessage : message}, callback);
    },

    setErrorMessage: function(message, callback) {
        this.setState({infoMessage_type: message_error_style, infoMessage : message}, callback);
    },

    verifyCommunication: function() {
        var connector = this.getCloverConnector();
        this.setState({cloverConnector: connector});
        this.contactDevice(connector);
    },


    getCloverConnector: function() {
        var connector = new clover.CloverConnectorFactory().createICloverConnector(
          {
              "clientId": this.state.clientId,
              "remoteApplicationId": this.state.remoteApplicationId,
              "deviceSerialId": this.state.deviceSerialId,
              "domain": this.state.domain,
              "merchantId": this.state.merchantId,
              "friendlyId": this.state.friendlyId
          }
        );
        var reactObjectReference = this;
        // Tap into the connect events only here.
        var ConnectOnlyCloverConnectorListener = Class.create( clover.remotepay.ICloverConnectorListener, {
            onConnected: function() {
                reactObjectReference.setState({cloverConnector_isConnected: true});
            },
            onDisconnected: function () {
                reactObjectReference.setState({cloverConnector_isConnected: false});
            }
        });
        var connectorListener = new ConnectOnlyCloverConnectorListener(connector);
        connector.addCloverConnectorListener(connectorListener);

        return connector;
    },

    /**
     *
     * @param {ICloverConnector} connector
     */
    contactDevice: function(connector) {
        var reactObjectReference = this;
        var ValidateCommunicationCloverConnectorListener = Class.create( clover.remotepay.ICloverConnectorListener, {
            /**
             *
             * @param {ICloverConnector} cloverConnector
             */
            initialize: function (cloverConnector) {
                this.cloverConnector = cloverConnector;
            },

            onConnected: function() {
                reactObjectReference.setNormalMessage(reactObjectReference.props.connToDeviceEstablished);
                log.debug("onConnected");
            },
            onDeviceError: function(deviceErrorEvent) {
                if(deviceErrorEvent.getCode() === clover.remotepay.DeviceErrorEventCode.SendNotificationFailure) {
                    reactObjectReference.setErrorMessage(deviceErrorEvent.getMessage());
                } else if(deviceErrorEvent.getCode() === clover.remotepay.DeviceErrorEventCode.AccessDenied) {
                    reactObjectReference.setErrorMessage(
                      "Cannot use device at this time.  Device is already connected to " +
                      deviceErrorEvent.getMessage() + ".");
                }
                log.debug("onDeviceError", deviceErrorEvent);
            },
            /**
             * @param {MerchantInfo} merchantInfo
             * @return void
             */
            onReady: function (merchantInfo) {
                reactObjectReference.setNormalMessage(reactObjectReference.props.merchConfigRetrvd);
                //Give the user a few seconds to see the device connect.
                log.debug("onReady", merchantInfo);
                if(reactObjectReference.props.onDeviceVerified) {
                    reactObjectReference.props.onDeviceVerified(this.cloverConnector);
                }

                setTimeout(function() {
                    if(reactObjectReference.state.modalIsOpen) {
                        this.cloverConnector.showMessage(reactObjectReference.props.devConnToFrndlyId + reactObjectReference.props.friendlyId);
                        reactObjectReference.setNormalMessage(reactObjectReference.props.posConnToFrndlyId_1 +
                          reactObjectReference.props.friendlyId + reactObjectReference.props.posConnToFrndlyId_2);
                        setTimeout(function () {
                            if (reactObjectReference.props.onDeviceVerified) {
                                if(reactObjectReference.state.modalIsOpen) {
                                    this.cloverConnector.showWelcomeScreen();
                                    reactObjectReference.setNormalMessage(
                                      reactObjectReference.props.posDevVerifiedCB);
                                }
                                reactObjectReference.setState({deviceVerified: true});
                                this.cloverConnector.removeCloverConnectorListener(this);
                            } else {
                                reactObjectReference.setNormalMessage(reactObjectReference.props.posCloseDev);
                                this.cloverConnector.dispose();
                            }
                        }.bind(this), 6000);
                    }
                }.bind(this), 1000);

            },
            onDisconnected: function() {
                reactObjectReference.setNormalMessage(reactObjectReference.props.posDevDisconnected);
                log.debug("onDisconnected");
                this.cloverConnector.removeCloverConnectorListener(this);
                reactObjectReference.saveConfiguration();
            }
        });
        var connectorListener = new ValidateCommunicationCloverConnectorListener(connector);
        connector.addCloverConnectorListener(connectorListener);

        connector.initializeConnection();
    },
    getServerListURL: function() {
        return this.props.serverUrl; //"./data/servers.json";
    },

    saveConfiguration: function() {
        if(this.props.configUrl) {
            $.ajax({
                url: this.props.configUrl + this.state.friendlyId,
                type: "POST",
                method: "POST",
                contentType:"application/json; charset=utf-8",
                dataType: 'json',
                data: JSON.stringify({
                    "clientId": this.state.clientId,
                    "remoteApplicationId": this.state.remoteApplicationId,
                    "deviceSerialId": this.state.deviceSerialId,
                    "domain": this.state.domain,
                    "merchantId": this.state.merchantId,
                    "friendlyId": this.state.friendlyId,
                    "oauthToken" : this.state.oauthToken
                }),
                cache: false,
                success: function (info) {
                    log.debug("saved config success response: ", info);
                }.bind(this),
                error: function (xhr, status, err) {
                    log.debug("saved config error response: ", status, err);
                }.bind(this)
            });
        }
    },

    loadConfiguration: function() {
        if(this.props.configUrl) {
            $.ajax({
                url: this.props.configUrl + this.props.friendlyId,
                method: "GET",
                dataType: 'json',
                cache: false,
                success: function (info) {
                    if(info) {
                        log.debug("load config success response: ", info);
                        this.setState(info);
                    }
                }.bind(this),
                error: function (xhr, status, err) {
                    log.debug("load config error response: ", status, err);
                }.bind(this)
            });
        }
    },

    isConnected: function() {
        return (this.state.cloverConnector !== null && this.state.cloverConnector_isConnected);
    },

    getConnectButtonText: function() {
        return this.isConnected() ?
          this.props.deviceDisconnectButtonText :
          this.props.deviceConnectButtonText;
    },

    onConnectButtonClicked: function() {
        if(this.isConnected()) {
            this.state.cloverConnector.dispose();
            this.setState({cloverConnector: null});
        } else {
            this.openModal();
            this.verifyCommunication();
        }
    },

    render: function() {
        return (
          <div>
              <button onClick={this.openModal}>{this.props.openButtonText}</button>
              <button disabled={!this.state.deviceSerialId}
                      onClick={this.onConnectButtonClicked}>{this.getConnectButtonText()}</button>
              <Modal
                isOpen={this.state.modalIsOpen}
                onAfterOpen={this.afterOpenModal}
                onRequestClose={this.closeModal}
                style={customStyles} >

                  <h2 ref="subtitle">{this.props.title}</h2>
                  <div ref="statusMessage" style={this.state.infoMessage_type}>{this.state.infoMessage}</div>
                  <form>
                      <CloverServerSelect
                        cloverServer={this.state.domain}
                        onServerSelected={this.handleServerSelected}
                        url={this.getServerListURL()} /><br/>
                      <DeviceSelect
                        onDeviceSelected={this.handleDeviceSelected}
                        url={this.state.domain}
                        deviceSerialId={this.state.deviceSerialId}
                        oauthToken={this.state.oauthToken}
                        merchantId={this.state.merchantId}
                        clientId={this.state.clientId}
                        remoteApplicationId={this.state.remoteApplicationId}
                      /><br/>
                      <div ref="buttonContainer">
                          <button type="button" onClick={this.verifyCommunication}
                                  disabled={!this.state.deviceSerialId}
                          >{this.props.verifyCommButton}</button>
                          <button disabled={!this.state.deviceVerified}
                                  type="button" ref="closeButton" onClick={this.closeModal}>{this.props.closeButton}</button>
                      </div>
                  </form>
              </Modal>
          </div>
        );
    }
});

//
// Expose the module.
//
if ('undefined' !== typeof module) {
    module.exports = ConfigureApp;
}
