/* ------------------------------------------------------------------
* IpAddress.js
* IPアドレスに関するユーティリティ
*
* Date: 2018-12-21
* ---------------------------------------------------------------- */
'use strict';
const mOs = require('os');

const IpAddressUtils = function (ip_version) {
	this._ip_version = (ip_version === 6) ? 6 : 4;
	this._net_if_list = null;

	// EL ポート番号
	this._ENL_PORT = 3610;
	// EL マルチキャストアドレス
	this._ENL_MULTICAST_ADDRESS_V4 = "224.0.23.0";
	this._ENL_MULTICAST_ADDRESS_V6 = "ff02::1";
};

/* ------------------------------------------------------------------
* getPortNumber()
* EL のポート番号を取得
* ---------------------------------------------------------------- */
IpAddressUtils.prototype.getPortNumber = function () {
	return this._ENL_PORT;
};

/* ------------------------------------------------------------------
* getMulticastAddress()
* EL のマルチキャストアドレスを取得
* ---------------------------------------------------------------- */
IpAddressUtils.prototype.getMulticastAddress = function () {
	if(this._ip_version === 6) {
		return this._ENL_MULTICAST_ADDRESS_V6;
	} else {
		return this._ENL_MULTICAST_ADDRESS_V4;
	}
};

/* ------------------------------------------------------------------
* getNetworkInterfaceList()
* ネットワークインタフェースのリストを取得
* ---------------------------------------------------------------- */
IpAddressUtils.prototype.getNetworkInterfaceList = function () {
	if(this._net_if_list) {
		return JSON.parse(JSON.stringify(this._net_if_list));
	}

	let netifs = mOs.networkInterfaces();
	let list = [];
	for (let dev in netifs) {
		netifs[dev].forEach((info) => {
			// ローカルアドレスは除外
			if(info.internal) {
				return;
			}
			// IPバージョンが違えば除外
			if (info.family !== 'IPv' + this._ip_version) {
				return;
			}
			// リンクローカルアドレスは除外
			let addr = info.address;
			if(this._ip_version === 6) {
				if(/^fe80\:\:/.test(addr)) {
					return;
				}
			} else {
				if(/^169\.254\./.test(addr)) {
					return;
				}
			}
			list.push(addr);
		});
	}

	this._net_if_list = JSON.parse(JSON.stringify(list));
	return list;
};


/* ------------------------------------------------------------------
* getNetworkScopeList()
* ネットワークインタフェースのスコープのリストを取得
* - IPv6 で setMulticastInterface() の引数に使われる
* - https://nodejs.org/api/dgram.html#dgram_socket_setmulticastinterface_multicastinterface
* ---------------------------------------------------------------- */
IpAddressUtils.prototype.getNetworkScopeList = function () {
	let netifs = mOs.networkInterfaces();
	let scopes = {}; 
	for (let dev in netifs) {
		netifs[dev].forEach((info) => {
			// ローカルアドレスは除外
			if(info.internal) {
				return;
			}
			// IPバージョンが違えば除外
			if (info.family !== 'IPv' + this._ip_version) {
				return;
			}
			// リンクローカルアドレスは除外
			let addr = info.address;
			if(this._ip_version === 6) {
				if(/^fe80\:\:/.test(addr)) {
					return;
				}
			} else {
				if(/^169\.254\./.test(addr)) {
					return;
				}
			}
			/*
			if(process.platform === 'win32') {
				let sid = info['scopeid'];
				scopes['::%' + sid] = true;
			} else {
				scopes['::%' + dev] = true;
			}
			*/
			scopes['::%' + dev] = true;
		});
	}
	let list = Object.keys(scopes);
	return list;
};

/* ------------------------------------------------------------------
* isLocalAddress(address)
* 指定のIPアドレスがローカルアドレスなら true を、そうでなければ false を
* 返す。
* ---------------------------------------------------------------- */
IpAddressUtils.prototype.isLocalAddress = function (address) {
	/*
	let net_if_list = this.getNetworkInterfaceList();
	if(net_if_list.indexOf(address) >= 0) {
		return true;
	} else {
		return false;
	}
	*/

	let netifs = mOs.networkInterfaces();
	let hit = false;
	for (let dev in netifs) {
		netifs[dev].forEach((info) => {
			// IPバージョンが違えば除外
			if (info.family !== 'IPv' + this._ip_version) {
				return;
			}
			if(info.address === address) {
				hit = true;
			}
		});
	}
	return hit;
};


module.exports = IpAddressUtils;
