/* ------------------------------------------------------------------
* PacketSender.js
* EL パケットを送信するモジュール
* - 同時に EL パケットを送信することがないようキュー管理する
*
* Date: 2018-12-21
* ---------------------------------------------------------------- */
'use strict';

const PacketSender = function (conf, udp, ip_address_utils) {
	this._conf = conf;
	this._udp = udp;
	this._ip_address_utils = ip_address_utils;

	this._queue = [];
	this._trans_timer = null;
	this._is_sending = false;
};

/* ------------------------------------------------------------------
* send(address, buf)
* パケットを送信する
*
* 引数
* - address | String | optional | 宛先 IP アドレス。
*           |        |          | 指定がなければマルチキャストアドレスがセットされる。
* - buf     | Buffer | required | パケットを表す Buffer オブジェクト
*
* 戻値
*   Promise オブジェクト
*
*   resolve() には、送信先の IP アドレスが引き渡される。
* ---------------------------------------------------------------- */
PacketSender.prototype.send = function (address, buf) {
	let promise = new Promise((resolve, reject) => {
		// IP アドレスの指定がなければマルチキャストアドレス
		if (!address) {
			address = this._ip_address_utils.getMulticastAddress();
		}
		// パケット送信キューに送信パケット情報を挿入
		this._pushPacketToQueue(address, buf, (error) => {
			if (error) {
				reject(error);
			} else {
				resolve(address);
			}
		});
	});
	return promise;
};

PacketSender.prototype._pushPacketToQueue = function (address, buf, callback) {
	this._queue.push({
		address: address,
		buffer: buf,
		callback: callback
	});
	if (!this._is_sending) {
		this._is_sending = true;
		this._sendPacketSequentially();
	}
};

PacketSender.prototype._sendPacketSequentially = function () {
	let packet = this._queue.shift();
	if (!packet) {
		this._is_sending = false;
		return;
	}
	this._is_sending = true;
	let buf = packet['buffer'];
	let address = packet['address'];
	let callback = packet['callback'];

	// マルチキャストかどうかを判定
	//   - Linux などではメンバーシップをドロップしないといけない。
	//   - その判定のために使う。
	let mc_flag = false;
	if (address === this._ip_address_utils.getMulticastAddress()) {
		mc_flag = true;
	}

	// マルチキャストならメンバーシップをドロップしてから処理する
	if (mc_flag) {
		this._dropMembership();
		setTimeout(() => {
			this._sendPacket(address, buf, (error) => {
				this._addMembership();
				this._trans_timer = null;
				callback(error);
				this._sendPacketSequentially();
			});
		}, 500);
	} else {
		this._sendPacket(address, buf, (error) => {
			this._trans_timer = null;
			callback(error);
			this._sendPacketSequentially();
		});
	}
};

PacketSender.prototype._sendPacket = function (address, buf, callback) {
	let port = this._ip_address_utils.getPortNumber();
	try {
		this._udp.send(buf, 0, buf.length, port, address, (error, bytes) => {
			callback(error);
		});
	} catch(e) {
		callback(e);
	}
};

PacketSender.prototype._addMembership = function () {
	/*
	if(this._conf['ip_address_version'] !== 4) {
		return;
	}
	*/
	try {
		let netif_list = this._ip_address_utils.getNetworkInterfaceList();
		let mc_address = this._ip_address_utils.getMulticastAddress();
		netif_list.forEach((netif) => {
			this._udp.addMembership(mc_address, netif);
		});
	} catch (e) { }
};

PacketSender.prototype._dropMembership = function () {
	/*
	if(this._conf['ip_address_version'] !== 4) {
		return;
	}
	*/
	try {
		let netif_list = this._ip_address_utils.getNetworkInterfaceList();
		let mc_address = this._ip_address_utils.getMulticastAddress();
		netif_list.forEach((netif) => {
			this._udp.dropMembership(mc_address, netif);
		});
	} catch (e) { }
};

module.exports = PacketSender;
