/* ------------------------------------------------------------------
* HttpApi.js
* REST API のフロントエンド
*
* ダッシュボードからの REST リクエストを受けて適切な処理を行う
*
* Date: 2019-03-05
* ---------------------------------------------------------------- */
'use strict';

/* ------------------------------------------------------------------
* Constructor
* ---------------------------------------------------------------- */
const HttpApi = function (conf, device, uconf, device_description, manufacturer_table) {
	this._conf = JSON.parse(JSON.stringify(conf));
	this._device = device;
	this._uconf = uconf;
	this._device_description = device_description;
	this._manufacturer_table = manufacturer_table;
};

HttpApi.prototype.updateConf = function (conf) {
	this._conf = JSON.parse(JSON.stringify(conf));
};

/* ------------------------------------------------------------------
* REST リクエスト受信
* request(req)
*
* - 引数:
*   req = {
*     reqId: 12,
*     method: "POST",
*     path: "/api/device/power",
*     params: {}
*   }
*
* - 戻値:
*   Promise オブジェクト
* 
* パラメータエラーなど、OS に起因しないエラーは reject() ではなく
* resolve() を呼び出す。
* ファイル書き込みエラーなど OS に起因するエラーは reject() を
* 呼び出す。
*
* resolve() には、結果を表すオブジェクトが渡される:
* {
*   "reqId": 1,
*   "method": "GET",
*   "path": "/api/system/lang",
*   "params": {},
*   "result": 0,
*   "code": 200,
*   "data": { // 成功時のみ
*     "lang": "en"
*   },
*   "message": "エラーメッセージ", // エラーの場合のみ,
*   "errs": {"key": "error_message,...} // エラーの場合のみ (メソッドによる)
* }
* ---------------------------------------------------------------- */
HttpApi.prototype.request = function (req) {
	let k = req['path'] + ' ' + req['method'].toLowerCase();

	/* ------------------------------------------------
	* システム設定
	* /api/system
	* ---------------------------------------------- */
	if (k === '/api/system/lang get') {
		// システム言語取得
		return this._systemLangGet(req);
	} else if (k === '/api/system/lang put') {
		// システム言語設定
		return this._systemLangPut(req);
	} else if (k === '/api/system/configurations get') {
		// システム設定情報取得
		return this._systemConfigurationsget(req);
	} else if (k === '/api/system/configurations put') {
		// システム設定情報保存
		return this._systemConfigurationsPut(req);

		/* ------------------------------------------------
		* Device Description 管理
		* /api/deviceDescriptions
		* ---------------------------------------------- */
	} else if (k === '/api/deviceDescriptions get') {
		// Device Description デバイス一覧取得
		return this._deviceDescriptionsGet(req);

	} else if (/^\/api\/deviceDescriptions\/[0-9A-F]{4,6} get$/.test(k)) {
		// Device Description デバイス情報取得
		return this._deviceDescriptionsDeviceGet(req);
	} else if (/^\/api\/deviceDescriptions\/[0-9A-F]{4,6}\/[A-Z] get$/.test(k)) {
		// Device Description デバイス情報取得
		return this._deviceDescriptionsDeviceGet(req);

	} else if (k === '/api/deviceDescriptions/releases get') {
		// 有効なリリースバージョンのリストを取得
		return this._deviceDescriptionsReleasesGet(req);

		/* ------------------------------------------------
		* メーカー
		* /api/manufacturers
		* ---------------------------------------------- */
	} else if (k === '/api/manufacturers get') {
		// メーカー情報一括取得
		return this._manufacturersGet(req);
	} else if (/^\/api\/manufacturers\/[0-9A-F]{6} get$/.test(k)) {
		// メーカー情報取得
		return this._manufacturersmanufacturerGet(req);

		/* ------------------------------------------------
		* デバイスリセット
		* /api/device
		* ---------------------------------------------- */
	} else if (k === '/api/device delete') {
		// デバイス初期化
		return this._deviceDelete(req);

		/* ------------------------------------------------
		* デバイス電源操作
		* /api/device/power
		* ---------------------------------------------- */
	} else if (k === '/api/device/power get') {
		// デバイス電源状態取得
		return this._devicePowerGet(req);
	} else if (k === '/api/device/power post') {
		// デバイス電源 ON
		return this._devicePowerPost(req);
	} else if (k === '/api/device/power delete') {
		// デバイス電源 Off
		return this._devicePowerDelete(req);

		/* ------------------------------------------------
		* デバイス EOJ 管理
		* /api/device/eojs
		* ---------------------------------------------- */
	} else if (k === '/api/device/eojs get') {
		// デバイス EOJ 一覧取得
		return this._deviceEojsGet(req);
	} else if (k === '/api/device/eojs put') {
		// デバイス EOJ 一括登録
		return this._deviceEojsPut(req);
	} else if (k === '/api/device/eojs post') {
		// デバイス EOJ 新規登録
		return this._deviceEojsPost(req);
	} else if (/^\/api\/device\/eojs\/[0-9A-F]{6} get$/.test(k)) {
		// デバイス EOJ 取得
		return this._deviceEojsEojGet(req);
	} else if (/^\/api\/device\/eojs\/[0-9A-F]{6} put$/.test(k)) {
		// デバイス EOJ 修正
		return this._deviceEojsEojPut(req);
	} else if (/^\/api\/device\/eojs\/[0-9A-F]{6} delete$/.test(k)) {
		// デバイス EOJ 削除
		return this._deviceEojsEojDelete(req);

		/* ------------------------------------------------
		* EPC 管理
		* /api/device/eojs/{eoj}/epcs
		* ---------------------------------------------- */
	} else if (/^\/api\/device\/eojs\/[0-9A-F]{6}\/epcs get$/.test(k)) {
		// デバイス EPC データ (EDT) 一括取得
		return this._deviceEpcsGet(req);
	} else if (/^\/api\/device\/eojs\/[0-9A-F]{6}\/epcs put$/.test(k)) {
		// デバイス EPC データ (EDT) 一括設定
		return this._deviceEpcsPut(req);
	} else if (/^\/api\/device\/eojs\/[0-9A-F]{6}\/epcs\/[0-9A-F]{2} get$/.test(k)) {
		// デバイス EPC データ (EDT) 個別取得
		return this._deviceEpcsEpcGet(req);
	} else if (/^\/api\/device\/eojs\/[0-9A-F]{6}\/epcs\/[0-9A-F]{2} put$/.test(k)) {
		// デバイス EPC データ (EDT) 個別設定
		return this._deviceEpcsEpcPut(req);

		/* ------------------------------------------------
		* EL パケット
		* /api/device/packet
		* ---------------------------------------------- */
	} else if (k === '/api/device/packet post') {
		// EL パケット送信
		return this._devicePacketPost(req);

		/* ------------------------------------------------
		* コントローラー
		* /api/controller
		* ---------------------------------------------- */
	} else if (k === '/api/controller/remoteDevices get') {
		// リモートデバイスの一覧を取得
		return this._controllerRemoteDevicesGet(req);
	} else if (k === '/api/controller/remoteDevices delete') {
		// リモートデバイスのクリア
		return this._controllerRemoteDevicesDelete(req);

	} else if (/^\/api\/controller\/remoteDevices\/[0-9A-Fa-f\.\:]+\/eojs\/[0-9A-F]{6}\/epcs\/[0-9A-F]{2} get/.test(k)) {
		// リモートデバイスの EPC データ (EDT) の個別取得
		return this._controllerRemoteDevicesEpcGet(req);
	} else if (/^\/api\/controller\/remoteDevices\/[0-9A-Fa-f\.\:]+\/eojs\/[0-9A-F]{6}\/epcs\/[0-9A-F]{2} put/.test(k)) {
		// リモートデバイスの EPC データ (EDT) の個別設定
		return this._controllerRemoteDevicesEpcPut(req);
	} else if (k === '/api/controller/discovery post') {
		// デバイス発見パケットを送信
		return this._controllerDiscoveryPost(req);

		/* ------------------------------------------------
		* その他
		* ---------------------------------------------- */
	} else {
		let promise = new Promise((resolve, reject) => {
			this._setReqToErrorRes(req, 1, 404, 'Unknown request method and path.');
			resolve(req);
		});
		return promise;
	}
};

HttpApi.prototype._setReqToSuccessRes = function (req, data) {
	req['result'] = 0;
	req['code'] = 200;
	if (data) {
		req['data'] = data;
	}
};

HttpApi.prototype._setReqToErrorRes = function (req, result, code, message) {
	req['result'] = result;
	req['code'] = code;
	req['message'] = message;
};

// システム言語取得
HttpApi.prototype._systemLangGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		this._setReqToSuccessRes(req, {
			lang: this._conf['lang']
		});
		resolve(req);
	});
	return promise;
};

// システム言語設定
HttpApi.prototype._systemLangPut = function (req) {
	let promise = new Promise((resolve, reject) => {
		let p = req['params'];
		this._uconf.set({ lang: p['lang'] }).then((res) => {
			// -------------------------------------------------------------
			// res:
			//   result | Interger | 値エラーの数 (すべて成功すれば 0),
			//   data   | Object   | 保存した設定値を格納したハッシュオブジェクト
			//                       エラーの場合は null がセットされる
			//   errs   | Object   | 不正な値のキーとエラーメッセージを格納したハッシュオブジェクト
			//                       すべて成功すれば null がセットされる
			// -------------------------------------------------------------
			Object.keys(res).forEach((k) => {
				req[k] = res[k];
			});
			if (res['result'] === 0) {
				req['code'] = 200;
			} else {
				req['code'] = 400;
				req['message'] = 'Parameter Error';
			}
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// システム設定情報取得
HttpApi.prototype._systemConfigurationsget = function (req) {
	let promise = new Promise((resolve, reject) => {
		let c = this._uconf.get();
		this._setReqToSuccessRes(req, c);
		resolve(req);
	});
	return promise;
};

// システム設定情報保存
HttpApi.prototype._systemConfigurationsPut = function (req) {
	let promise = new Promise((resolve, reject) => {
		let p = req['params'];
		this._uconf.set(p).then((res) => {
			// -------------------------------------------------------------
			// res:
			//   result | Interger | 値エラーの数 (すべて成功すれば 0),
			//   data   | Object   | 保存した設定値を格納したハッシュオブジェクト
			//                       エラーの場合は null がセットされる
			//   errs   | Object   | 不正な値のキーとエラーメッセージを格納したハッシュオブジェクト
			//                       すべて成功すれば null がセットされる
			// -------------------------------------------------------------
			Object.keys(res).forEach((k) => {
				req[k] = res[k];
			});
			if (res['result'] === 0) {
				req['code'] = 200;
			} else {
				req['code'] = 400;
				req['message'] = 'Parameter Error';
			}
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// Device Description デバイス一覧取得
HttpApi.prototype._deviceDescriptionsGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		let list = this._device_description.getDeviceList();
		this._setReqToSuccessRes(req, {
			deviceList: list
		});
		resolve(req);
	});
	return promise;
};

// Device Description デバイス情報取得
HttpApi.prototype._deviceDescriptionsDeviceGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		let path_part_list = req['path'].split(/\//);
		let eoj = path_part_list[3];
		let release = path_part_list[4];
		let desc = this._device_description.getEoj(eoj, release);
		if (desc) {
			// elProperties は、内部的には EPC をキーとしたハッシュオブジェクトだが、
			// 戻値は、オリジナルの deviceDescription に合わせて Array にする
			// Array のほうがダッシュボードの JS で扱いやすいという理由もある
			let prop_list = [];
			Object.keys(desc['elProperties']).sort().forEach((epc_hex) => {
				prop_list.push(desc['elProperties'][epc_hex]);
			});
			desc['elProperties'] = prop_list;

			this._setReqToSuccessRes(req, {
				device: desc
			});
		} else {
			this._setReqToErrorRes(req, 1, 404, 'The information for the specified EOJ was not found in the ECHONET Lite Device Description: ' + eoj);
		}
		resolve(req);
	});
	return promise;
};

// 有効なリリースバージョンのリストを取得
HttpApi.prototype._deviceDescriptionsReleasesGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		let list = this._device_description.getReleaseList();
		this._setReqToSuccessRes(req, {
			releaseList: list
		});
		resolve(req);
	});
	return promise;
};

// メーカー情報一括取得
HttpApi.prototype._manufacturersGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		let list = this._manufacturer_table.getList();
		this._setReqToSuccessRes(req, {
			manufacturerList: list
		});
		resolve(req);
	});
	return promise;
};

// メーカー情報取得
HttpApi.prototype._manufacturersmanufacturerGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		let path_part_list = req['path'].split(/\//);
		let code = path_part_list[3];
		let name = this._manufacturer_table.get(code);
		if (name) {
			this._setReqToSuccessRes(req, {
				manufacturer: {
					code: code,
					name: name
				}
			});
		} else {
			this._setReqToErrorRes(req, 1, 404, 'The information for the specified manufacturer code was not found in the manufacturer table: ' + code);
		}
		resolve(req);
	});
	return promise;
};

// デバイスリセット
HttpApi.prototype._deviceDelete = function (req) {
	let promise = new Promise((resolve, reject) => {
		this._device.reset().then(() => {
			this._setReqToSuccessRes(req);
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイス電源状態取得
HttpApi.prototype._devicePowerGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		this._setReqToSuccessRes(req, {
			powerStatus: this._device.getPowerStatus()
		});
		resolve(req);
	});
	return promise;
};

// デバイス電源 ON
HttpApi.prototype._devicePowerPost = function (req) {
	let promise = new Promise((resolve, reject) => {
		this._device.start().then(() => {
			this._setReqToSuccessRes(req, {
				powerStatus: this._device.getPowerStatus()
			});
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイス電源 Off
HttpApi.prototype._devicePowerDelete = function (req) {
	let promise = new Promise((resolve, reject) => {
		this._device.stop().then(() => {
			this._setReqToSuccessRes(req, {
				powerStatus: this._device.getPowerStatus()
			});
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイス EOJ 一覧取得
HttpApi.prototype._deviceEojsGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		this._setReqToSuccessRes(req, {
			eojList: this._device.getCurrentEojList()
		});
		resolve(req);
	});
	return promise;
};

// デバイス EOJ 一括登録
HttpApi.prototype._deviceEojsPut = function (req) {
	let promise = new Promise((resolve, reject) => {
		let p = req['params'];
		if (!p) {
			this._setReqToErrorRes(req, 1, 400, 'No parameter');
			resolve(req);
			return;
		}
		if (!('eojList' in p)) {
			this._setReqToErrorRes(req, 1, 400, 'The `eojList` is required.');
			resolve(req);
			return;
		}
		let list = p['eojList'];
		if (!Array.isArray(list) || list.length === 0) {
			this._setReqToErrorRes(req, 1, 400, 'The `eojList` must be a non-empty array.');
			resolve(req);
			return;
		}

		// 登録処理
		this._device.setCurrentEojList(list).then((res) => {
			if (res['result'] === 0) {
				this._setReqToSuccessRes(req, {
					eojList: res['data']['eojList']
				});
			} else {
				this._setReqToErrorRes(req, 1, 400, res['message']);
			}
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイス EOJ 新規登録
HttpApi.prototype._deviceEojsPost = function (req) {
	let promise = new Promise((resolve, reject) => {
		let p = req['params'];
		if (!p) {
			this._setReqToErrorRes(req, 1, 400, 'No parameter');
			resolve(req);
			return;
		}
		if (!('eoj' in p)) {
			this._setReqToErrorRes(req, 1, 400, 'The `eoj` is required.');
			resolve(req);
			return;
		}
		if ('epc' in p) {
			let list = p['epc'];
			if (!Array.isArray(list) || list.length === 0) {
				this._setReqToErrorRes(req, 1, 400, 'The `epc` must be a non-empty array.');
				resolve(req);
				return;
			}
		}
		if ('release' in p) {
			let r = p['release'];
			if (!/^[a-zA-Z]$/.test(r)) {
				this._setReqToErrorRes(req, 1, 400, 'The `release` must be an alphabetical letter ([a-zA-Z]).');
				resolve(req);
				return;
			}

		}
		this._device.addCurrentEoj(p).then((res) => {
			if (res['result'] === 0) {
				this._setReqToSuccessRes(req, res['data']);
			} else {
				this._setReqToErrorRes(req, 1, 400, res['message']);
			}
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイス EOJ 取得
HttpApi.prototype._deviceEojsEojGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		let path_part_list = req['path'].split(/\//);
		let eoj = path_part_list[4].toUpperCase();
		let o = this._device.getCurrentEoj(eoj);
		if (o) {
			this._setReqToSuccessRes(req, o);
		} else {
			this._setReqToErrorRes(req, 1, 404, 'The specified EOJ was not found in the device EOJ list: ' + eoj);
		}
		resolve(req);
	});
	return promise;
};

// デバイス EOJ 修正
HttpApi.prototype._deviceEojsEojPut = function (req) {
	let promise = new Promise((resolve, reject) => {
		let path_part_list = req['path'].split(/\//);
		let eoj = path_part_list[4].toUpperCase();

		let p = req['params'];
		if (!p) {
			p = {};
		}
		if ('epc' in p) {
			let list = p['epc'];
			if (!Array.isArray(list) || list.length === 0) {
				this._setReqToErrorRes(req, 1, 400, 'The `epc` must be a non-empty array.');
				resolve(req);
				return;
			}
		}

		p['eoj'] = eoj;

		this._device.updateCurrentEoj(p).then((res) => {
			if (res['result'] === 0) {
				this._setReqToSuccessRes(req, res['data']);
			} else {
				if (res['result'] === 404) {
					this._setReqToErrorRes(req, 1, 404, res['message']);
				} else {
					this._setReqToErrorRes(req, 1, 400, res['message']);
				}
			}
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイス EOJ 削除
HttpApi.prototype._deviceEojsEojDelete = function (req) {
	let promise = new Promise((resolve, reject) => {
		let path_part_list = req['path'].split(/\//);
		let eoj = path_part_list[4].toUpperCase();

		this._device.deleteCurrentEoj(eoj).then((res) => {
			if (res['result'] === 0) {
				this._setReqToSuccessRes(req, res['data']);
			} else {
				if (res['result'] === 404) {
					this._setReqToErrorRes(req, 1, 404, res['message']);
				} else {
					this._setReqToErrorRes(req, 1, 400, res['message']);
				}
			}
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイス EPC データ (EDT) 一括取得
HttpApi.prototype._deviceEpcsGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		let path_part_list = req['path'].split(/\//);
		let eoj = path_part_list[4].toUpperCase();

		let o = this._device.getCurrentEoj(eoj);
		if (!o) {
			this._setReqToErrorRes(req, 1, 404, 'The specified EOJ was not found: ' + eoj);
			resolve(req);
			return;
		}

		let props = [];
		o['epc'].forEach((epc) => {
			props.push({
				epc: epc,
				edt: true
			});
		});

		this._device.getEpcValues(eoj, props).then((res) => {
			this._setReqToSuccessRes(req, {
				elProperties: res['elProperties']
			});
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイス EPC データ (EDT) 一括設定
HttpApi.prototype._deviceEpcsPut = function (req) {
	let promise = new Promise((resolve, reject) => {
		let path_part_list = req['path'].split(/\//);
		let eoj = path_part_list[4].toUpperCase();

		let o = this._device.getCurrentEoj(eoj);
		if (!o) {
			this._setReqToErrorRes(req, 1, 404, 'The specified EOJ was not found: ' + eoj);
			resolve(req);
			return;
		}

		let p = req['params'];

		let return400Res = (message) => {
			this._setReqToErrorRes(req, 1, 400, message);
			resolve(req);
			return;
		};

		if (!p || typeof (p) !== 'object') {
			return400Res('No parameter was found.');
		}

		let vals = p['vals'];
		if (!vals) {
			return400Res('The `vals` is required.');
		} else if (typeof (vals) !== 'object' || Object.keys(vals).length === 0) {
			return400Res('The `vals` must be a non-empty object.');
		}

		let props = [];
		let epc_list = Object.keys(vals);
		for (let i = 0, len = epc_list.length; i < len; i++) {
			let epc = epc_list[i];
			let edt = vals[epc];
			if (!/^[0-9A-F]{2}$/.test(epc)) {
				err = 'Invalid EPC: ' + epc;
				break;
			}
			if (!/^[0-9A-F]+$/.test(epc) && epc.length % 2 !== 0) {
				err = 'Invalid EDT: ' + edt;
				break;
			}
			props.push({
				epc: epc,
				edt: edt
			});
		}

		this._device.setEpcValues(eoj, props).then((res) => {
			if (res['result'] === 0) {
				this._setReqToSuccessRes(req, {
					changed: res['changed']
				});
				resolve(req);
			} else {
				return400Res(res['message']);
			}
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイス EPC データ (EDT) 個別取得
HttpApi.prototype._deviceEpcsEpcGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		let path_part_list = req['path'].split(/\//);
		let eoj = path_part_list[4].toUpperCase();
		let epc = path_part_list[6].toUpperCase();

		let o = this._device.getCurrentEoj(eoj);
		if (!o) {
			this._setReqToErrorRes(req, 1, 404, 'The specified EOJ was not found: ' + eoj);
			resolve(req);
			return;
		}

		let props = [{ epc: epc, edt: '' }];
		this._device.getEpcValues(eoj, props).then((res) => {
			let prop_list = res['elProperties'];
			if (prop_list && Array.isArray(prop_list) && prop_list.length > 0 && prop_list[0]['edt']) {
				this._setReqToSuccessRes(req, {
					elProperty: prop_list[0]
				});
			} else {
				this._setReqToErrorRes(req, 1, 404, 'The specified EPC was not found: ' + epc);
			}
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイス EPC データ (EDT) 個別設定
HttpApi.prototype._deviceEpcsEpcPut = function (req) {
	let promise = new Promise((resolve, reject) => {
		let path_part_list = req['path'].split(/\//);
		let eoj = path_part_list[4].toUpperCase();
		let epc = path_part_list[6].toUpperCase();

		let o = this._device.getCurrentEoj(eoj);
		if (!o) {
			this._setReqToErrorRes(req, 1, 404, 'The specified EOJ was not found: ' + eoj);
			resolve(req);
			return;
		}

		let p = req['params'];

		let return400Res = (message) => {
			this._setReqToErrorRes(req, 1, 400, message);
			resolve(req);
			return;
		};

		if (!p || typeof (p) !== 'object') {
			return400Res('No parameter was found.');
		}

		let edt = p['edt'];
		if (!edt) {
			return400Res('The `edt` is required.');
		} else if (typeof (edt) !== 'string' || !/^[0-9A-F]+$/.test(edt) || edt.length % 2 !== 0) {
			return400Res('The `edt` is invalid as an EDT.');
		}

		let props = [{
			epc: epc,
			edt: edt
		}];

		this._device.setEpcValues(eoj, props).then((res) => {
			if (res['result'] === 0) {
				this._setReqToSuccessRes(req, {
					changed: res['changed']
				});
				resolve(req);
			} else {
				return400Res(res['message']);
			}
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// EL パケット送信
HttpApi.prototype._devicePacketPost = function (req) {
	let promise = new Promise((resolve, reject) => {
		/* ----------------------------------------------------------
		* req['params]     | Object  | required |
		*   - address      | String  | required | 宛先 IP アドレス
		*   - packet       | Object  | required | パケットを表すハッシュオブジェクト
		*     - tid        | integer | optional | 指定がなけれは自動採番
		*     - seoj       | string  | required | 16進数文字列 (例: "013001")
		*     - deoj       | string  | required | 16進数文字列 (例: "05FF01")
		*     - esv        | string  | required | ESV キーワード (例: "GET_RES") または 16進数文字列
		*     - properties | array   | required | object のリスト
		*       - epc      | string  | required | EPCの16進数文字列 (例: "80")
		*       - edt      | string  | optional | EDTの16進数文字列
		* --------------------------------------------------------- */
		let p = JSON.parse(JSON.stringify(req['params']));

		let return400Res = (message) => {
			this._setReqToErrorRes(req, 1, 400, message);
			resolve(req);
			return;
		};

		if (!p || typeof (p) !== 'object') {
			return400Res('Address and packet informaion are reuqired.');
		}

		let address = p['address'];
		if (!address) {
			return400Res('The `address` is required.');
		} else if (typeof (address) !== 'string') {
			return400Res('The `address` must be an IP address.');
		}

		let packet = p['packet'];
		if (!packet) {
			return400Res('The `packet` is required.');
		} else if (typeof (packet) !== 'object') {
			return400Res('The `packet` must be an object representing a packet.');
		}

		let tid = packet['tid'];
		if(tid && typeof(tid) === 'string' && /^\d+$/.test(tid)) {
			packet['tid'] = parseInt(tid, 10);
		}

		this._device.sendPacket(address, packet).then((res) => {
			if (res['result'] === 0) {
				this._setReqToSuccessRes(req);
				resolve(req);
			} else {
				return400Res(res['message']);
			}
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// リモートデバイスの一覧を取得
HttpApi.prototype._controllerRemoteDevicesGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		let res = this._device.getRemoteDeviceList();
		if (res['result'] === 0) {
			this._setReqToSuccessRes(req, {
				remoteDeviceList: res['remoteDeviceList']
			});
		} else {
			this._setReqToErrorRes(req, 1, res['code'], res['message']);
		}
		resolve(req);
	});
	return promise;
};

// リモートデバイスをクリア
HttpApi.prototype._controllerRemoteDevicesDelete = function (req) {
	let promise = new Promise((resolve, reject) => {
		let res = this._device.deleteRemoteDeviceList();
		if (res['result'] === 0) {
			this._setReqToSuccessRes(req, null);
		} else {
			this._setReqToErrorRes(req, 1, res['code'], res['message']);
		}
		resolve(req);
	});
	return promise;
};

// リモートデバイスの EPC データ (EDT) の個別取得
HttpApi.prototype._controllerRemoteDevicesEpcGet = function (req) {
	let promise = new Promise((resolve, reject) => {
		let path_part_list = req['path'].split(/\//);
		let address = path_part_list[4];
		let eoj = path_part_list[6].toUpperCase();
		let epc = path_part_list[8].toUpperCase();
		this._device.getRemoteDeviceEpcData(address, eoj, epc).then((res) => {
			if (res['result'] === 0) {
				this._setReqToSuccessRes(req, {
					elProperty: res['elProperty']
				});
			} else {
				this._setReqToErrorRes(req, 1, res['code'], res['message']);
			}
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// リモートデバイスの EPC データ (EDT) の個別設定
HttpApi.prototype._controllerRemoteDevicesEpcPut = function (req) {
	let promise = new Promise((resolve, reject) => {
		let path_part_list = req['path'].split(/\//);
		let address = path_part_list[4];
		let eoj = path_part_list[6].toUpperCase();
		let epc = path_part_list[8].toUpperCase();

		let p = req['params'];

		let return400Res = (message) => {
			this._setReqToErrorRes(req, 1, 400, message);
			resolve(req);
			return;
		};

		if (!p || typeof (p) !== 'object') {
			return400Res('Parameter Error');
		}

		let edt = p['edt'];

		if (!edt) {
			return400Res('The `edt` is required.');
		} else if (typeof (edt) !== 'string') {
			return400Res('The `edt` must be an IP address.');
		}

		this._device.setRemoteDeviceEpcData(address, eoj, epc, edt).then((res) => {
			if (res['result'] === 0) {
				this._setReqToSuccessRes(req, {
					property: res['property']
				});
			} else {
				this._setReqToErrorRes(req, 1, res['code'], res['message']);
			}
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

// デバイス発見パケットを送信
HttpApi.prototype._controllerDiscoveryPost = function (req) {
	let promise = new Promise((resolve, reject) => {
		this._device.sendDiscoveryPacket().then((res) => {
			if (res['result'] === 0) {
				this._setReqToSuccessRes(req);
			} else {
				this._setReqToErrorRes(req, 1, res['code'], res['message']);
			}
			resolve(req);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};


module.exports = HttpApi;
