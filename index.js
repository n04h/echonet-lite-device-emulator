/* ------------------------------------------------------------------
* index.js
* ELエミュレータ起動スクリプト
*
* システムのコントローラーとしての役割を担う
* 以下のイベントを検知したら適切なモジュールへ中継する
*  - REST API リクエスト受信
*  - EL パケット受信
*  - EL パケット送信
*  - ユーザー設定情報更新
*
* Date: 2021-08-24
* ---------------------------------------------------------------- */
'use strict';
const VERSION = '20210909';
const mDevice = require('./lib/Device.js');
const mHttpApi = require('./lib/HttpApi.js');
const mHttpServer = require('./lib/HttpServer.js');
const mDeviceDescription = require('./lib/DeviceDescription.js');
const mManufacturerTable = require('./lib/ManufacturerTable.js');
const mUserConf = require('./lib/UserConf.js');
const mConsole = require('./lib/Console.js');

/* ------------------------------------------------------------------
* Constructor
* ---------------------------------------------------------------- */
const Emulator = function (options) {
	this._conf = require('./conf/config.js');
	for (let k in options) {
		this._conf[k] = options[k];
	}

	this._device = null;
	this._api = null;
	this._console = new mConsole();
	this._http = new mHttpServer(this._conf, this._console);
	this._uconf = new mUserConf(this._conf);
};

// 初期化
Emulator.prototype.init = function () {
	// ASCII アート出力
	this._console.printStartLogoAsciiArt();
	// バージョン出力
	this._console.printVersion(VERSION);
	// DeviceDescription のメタ情報を出力
	this._console.printDeviceDescriptionMetaData(mDeviceDescription.getMetaData());

	// ユーザー設定情報を取得
	this._console.printSysInitMsg('Loading the configurations...');
	this._uconf.init();
	let user_conf = this._uconf.get();
	// ユーザー設定情報を反映
	this._updatedUserConf(user_conf);
	// ユーザー設定情報の更新があったら反映
	this._uconf.onupdated = (user_conf) => {
		this._updatedUserConf(user_conf);
	};
	this._console.printSysInitRes('OK');

	// HTTP/WebSocket サーバー起動
	this._console.printSysInitMsg('Starting HTTP/WebSocket server...');
	this._http.start().then(() => {
		this._console.printSysInitRes('OK');
		this._console.printSysInfo('  - TCP port: ' + this._conf['dashboard_port']);
		// HTTP リクエストを受信したときの処理
		this._http.onrequested = (req) => {
			this._httpApiRequested(req)
		};
		// デバイス起動
		return this._startDevice();
	}).then((device) => {
		this._device = device;

		// HTTP REST API エンドポイントの構築
		this._api = new mHttpApi(this._conf, this._device, this._uconf, mDeviceDescription, mManufacturerTable);

		this._console.printSysInfo('This emulator is ready');
	}).catch((error) => {
		console.error(error);
	});
};

// デバイスを(再)起動
Emulator.prototype._startDevice = function () {
	let promise = new Promise((resolve, reject) => {
		let device = null;
		this._stopDevice().then(() => {
			// EL デバイスのインスタンスを生成
			device = new mDevice(this._conf, mDeviceDescription, mManufacturerTable, this._console);
			// EL デバイスを初期化
			return device.init();
		}).then(() => {
			// EL パケット受信イベントリスナーをセット
			device.onreceived = (address, packet) => {
				this._http.wsSend({
					event: 'packetreceived',
					data: {
						direction: 'RX',
						address: address,
						packet: packet
					}
				});
			};
			// EL パケット送信イベントリスナーをセット
			device.onsent = (address, packet) => {
				this._http.wsSend({
					event: 'packetsent',
					data: {
						direction: 'TX',
						address: address,
						packet: packet
					}
				});
			};
			// EPC 更新イベントリスナーをセット
			device.onepcupdated = (data) => {
				this._http.wsSend({
					event: 'epcupdated',
					data: data
				});
			};
			// デバイス電源状態変化イベントリスナーをセット
			device.onpowerstatuschanged = (data) => {
				this._http.wsSend({
					event: 'powerstatuschanged',
					data: data
				});
			};
			// リモートデバイス発見イベントリスナーをセット
			device.ondiscovered = (data) => {
				this._http.wsSend({
					event: 'discovered',
					data: data
				});
			};
			// リモートデバイスロストイベントリスナーをセット
			device.ondisappeared = (data) => {
				this._http.wsSend({
					event: 'disappeared',
					data: data
				});
			};
			// リモートデバイス EPC 更新イベントリスナーをセット
			device.onremoteepcupdated = (data) => {
				this._http.wsSend({
					event: 'remoteepcupdated',
					data: data
				});
			}
			// デバイス起動
			return device.start();
		}).then(() => {
			resolve(device);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイスを停止
Emulator.prototype._stopDevice = function () {
	let promise = new Promise((resolve, reject) => {
		if (!this._device) {
			resolve();
			return;
		}
		this._device.stop().then(() => {
			this._device = null;
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// REST リクエストを受けたら HttpApi (this._api) モジュールに中継
Emulator.prototype._httpApiRequested = function (data) {
	/*
	* 受信データのサンプル
	* data = {
	*   reqId: 12,
	*   method: "POST",
	*   path: "/api/device/power",
	*   params: {}
	* }
	*/

	this._api.request(data).then((rdata) => {
		/*
		* レスポンスデータのサンプル
		* rdata = {
		*   "reqId": 1,
		*   "method": "GET",
		*   "path": "/api/system/lang",
		*   "params": {},
		*   "result": 0,
		*   "code": 200,
		*   "data": {
		*     "lang": "en"
		*   }
		* }
		*/
		this._http.respond(rdata['code'], rdata);
	}).catch((error) => {
		data['result'] = 1;
		data['code'] = 500;
		data['message'] = error.message;
		this._http.respond(500, data);

		console.error(error);
	});
};

// ユーザー設定情報更新イベントを受けたときの処理
Emulator.prototype._updatedUserConf = function (user_conf) {
	for (let k in user_conf) {
		this._conf[k] = user_conf[k];
	}
	if (this._api) {
		this._api.updateConf(this._conf);
	}
	if (this._device) {
		this._device.updateConf(this._conf);
	}
};



/* ------------------------------------------------------------------
* コマンドラインオプション
* --enable-console-packet:
*     パケット送受信出力を有効にする
* --disable-clock
*     EPC:0x97, 0x98 の日時を OS の時計と同期しないモード
* ---------------------------------------------------------------- */
let options = {
	'console-packet': false,
	'clock-sync': true
};
process.argv.forEach((opt) => {
	if (!/^\-\-/.test(opt)) {
		return;
	}
	let k = opt.replace(/^\-\-(enable|disable)\-/, '');
	if (!(k in options)) {
		console.error('Unknown command line switch: ' + opt);
		process.exit();
	}
	if (/^\-\-enable/.test(opt)) {
		options[k] = true;
	} else if (/^\-\-disable/.test(opt)) {
		options[k] = false;
	}
});
// EL エミュレーター起動
let mEmulator = new Emulator(options);
mEmulator.init();
