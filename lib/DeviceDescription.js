/* ------------------------------------------------------------------
* DeviceDescription.js
* EL_DeviceDesctiption.json のデータを扱うモジュール
* https://github.com/KAIT-HEMS/ECHONET-APPENDIX/blob/master/EL_DeviceDescription_J.md
*
* - EL_DeviceDescription.json を扱いやすいように以下の通りに変換
*   - 0xFF を FF に変換 (0x の削除)
*   - superclass および definitions をマージする (node profile を除く)
* - EOJ を指定したら、それに該当するデータを返す
*   - EPC のリストを与えると、それだけにフィルターする
*
* Date: 2019-10-27
* ---------------------------------------------------------------- */
'use strict';
const mPath = require('path');

const DeviceDescription = function () {
	this._common = {};
	this._devices = {};
	this._caches = {};
	this._standard_version = '';
	this._meta_data = null;
};

/* ------------------------------------------------------------------
* init()
* ---------------------------------------------------------------- */
DeviceDescription.prototype.init = function () {
	// Device Description を読み込む
	let desc_json_path = mPath.resolve(__dirname, '../conf/EL_DeviceDescription.json');
	let all_desc = require(desc_json_path);

	// 規格 Version 情報 
	let std_ver = all_desc['metaData']['release'];
	if (std_ver) {
		this._standard_version = std_ver.toUpperCase();
	} else {
		throw new Error('The release version was not found in the `EL_DeviceDescription.json`.');
	}

	// メタ情報
	this._meta_data = all_desc['metaData'];

	// definitions
	let defs = all_desc['definitions'];
	this._margeDefinitions(defs, JSON.parse(JSON.stringify(defs)));

	// devices の変換
	let desc_devices = {};
	Object.keys(all_desc['devices']).forEach((eoj) => {
		let desc_dev = all_desc['devices'][eoj];
		// プロパティ情報に definitions をマージ
		this._margeDefinitions(desc_dev, defs);
		// EPC の 0x を削除
		this._remove0xFromEpc(desc_dev);
		// EOJ の 0x を削除して desc_devices に追加
		eoj = eoj.replace(/^0x/, '').toUpperCase();
		if ('oneOf' in desc_dev) {
			desc_dev['oneOf'].forEach((d) => {
				d['eoj'] = eoj;
			});
		} else {
			desc_dev['eoj'] = eoj;
		}
		desc_devices[eoj] = desc_dev;
	});

	// common (Super Class)
	this._common = desc_devices['0000'];
	delete desc_devices['0000'];

	this._devices = desc_devices;
};

DeviceDescription.prototype._remove0xFromEpc = function (o) {
	if (!o || typeof (o) !== 'object') {
		return;
	}
	Object.keys(o).forEach((k) => {
		let v = o[k];
		if (k === 'elProperties') {
			let props = {};
			Object.keys(v).forEach((epc) => {
				let p = v[epc];
				epc = epc.replace(/^0x/, '').toUpperCase();
				if ('oneOf' in p) {
					p['oneOf'].forEach((d) => {
						d['epc'] = epc;
					});
				} else {
					p['epc'] = epc;
				}
				props[epc] = p;
			});
			o[k] = props;
		} else {
			this._remove0xFromEpc(v);
		}
	});
};

DeviceDescription.prototype._margeDefinitions = function (props, defs) {
	if (typeof (props) === 'object' && props !== null) {
		Object.keys(props).forEach((k) => {
			let v = props[k];
			if (k === '$ref') {
				if (/^\#\/definitions\/[^\/]+$/.test(v)) {
					let defk = v.replace(/^\#\/definitions\//, '');
					if (defs[defk]) {
						delete props['$ref'];
						Object.assign(props, defs[defk]);
					} else {
						console.error('Definition Parse Error: ' + $v);
					}
				} else {
					console.error('Definition Parse Error: ' + $v);
				}
			} else {
				this._margeDefinitions(v, defs);
			}
		});
	} else if (Array.isArray(props)) {
		props.forEach((el) => {
			this._margeDefinitions(el, defs);
		});
	} else {
		return;
	}
};

DeviceDescription.prototype.getCommon = function () {
	return JSON.parse(JSON.stringify(this._common));
};

/* ------------------------------------------------------------------
* getStandardVersion()
* 規格 Version 情報を返す
* ---------------------------------------------------------------- */
DeviceDescription.prototype.getStandardVersion = function () {
	return this._standard_version;
};

/* ------------------------------------------------------------------
* getDeviceList()
* すべてのデバイス情報を返す。EPC の情報は含まれない。
* ダッシュボードでプルダウン表示のために使う
* ---------------------------------------------------------------- */
DeviceDescription.prototype.getDeviceList = function () {
	let list = [];
	Object.keys(this._devices).forEach((code) => {
		let dev = this._devices[code];
		if ('oneOf' in dev) {
			let last_idx = dev['oneOf'].length - 1;
			let last_dev = dev['oneOf'][last_idx];
			let first_release = 'Z';
			dev['oneOf'].forEach((d) => {
				if (d['validRelease'] && d['validRelease']['from']) {
					let r = d['validRelease']['from'].toUpperCase();
					if(r < first_release) {
						first_release = r;
					}
				}
			});
			list.push({
				eoj: last_dev['eoj'],
				className: last_dev['className'],
				firstRelease: first_release
			});
		} else {
			let first_release = 'A';
			if (dev['validRelease'] && dev['validRelease']['from']) {
				first_release = dev['validRelease']['from'].toUpperCase();
			}
			list.push({
				eoj: dev['eoj'],
				className: dev['className'],
				firstRelease: first_release
			});
		}
	});
	return JSON.parse(JSON.stringify(list));
};

/* ------------------------------------------------------------------
* getEoj(eoj, epc_list, release)
* 指定の EOJ から EOJ 自身の情報と EPC の情報を返す
*
* - epc_list を指定すると、指定された EPC のみにフィルターする
* - release を指定すると、指定のリリースバージョンにそぐわない EPC は除外する
* - もし epc_list を指定せずに release を指定したい場合は、epc_list を
*   null にする (例: getEoj('0130', null, 'J'))
* - もし release に不正な値が指定されたら、エラーにせず、this._standard_version
*   を適用する
* - release が指定されなかったときも同様
* ---------------------------------------------------------------- */
DeviceDescription.prototype.getEoj = function (eoj, epc_list, release) {
	// 引数 eoj をチェック
	if (!eoj || typeof (eoj) !== 'string' || !/^[0-9a-fA-F]{4,}$/.test(eoj)) {
		return null;
	}
	eoj = eoj.substring(0, 4).toUpperCase();

	// 引数 release のチェック
	if (release) {
		if (typeof (release) !== 'string' || !/^[a-zA-Z]$/.test(release)) {
			release = this._standard_version;
		}
		release = release.toUpperCase();
		if (release > this._standard_version) {
			release = this._standard_version;
		}
	} else {
		release = this._standard_version;
	}

	// 指定の EOJ のデータを検索
	if (!(eoj in this._devices)) {
		return null;
	}

	let d = JSON.parse(JSON.stringify(this._devices[eoj]));
	let data = { eoj: eoj, release: release };
	Object.assign(data, d);

	// oneOf があった場合に validRelease を見て該当する項目のみを抽出
	data = this._selectOneOfByRelease(data, release);

	// common (Super Class) に oneOf があった場合に validRelease を見て該当する項目のみを抽出
	let common_props = this._selectOneOfByRelease(this._common['elProperties'], release);

	// ノードプロファイルでなければ、common (Super Class) のデータをマージ
	// - device 側を優先する
	if (!/^0EF0/.test(eoj)) {
		Object.keys(common_props).forEach((epc) => {
			let p = common_props[epc];
			if (!data['elProperties'][epc]) {
				data['elProperties'][epc] = JSON.parse(JSON.stringify(p));
			}
		});
	}

	// リリースに該当しない EPC データを削除
	Object.keys(data['elProperties']).forEach((epc) => {
		let epc_data = data['elProperties'][epc];
		if (!this._isValidRelease(epc_data['validRelease'], release)) {
			delete data['elProperties'][epc];
		}
	});

	// EPC リストが与えられていればフィルタリング
	if (epc_list && Array.isArray(epc_list) && epc_list.length > 0) {
		let props = {};
		epc_list.forEach((epc) => {
			epc = epc.toUpperCase();
			if (data['elProperties'][epc]) {
				props[epc] = data['elProperties'][epc];
			}
		});
		data['elProperties'] = props;
	}

	// elProperties を EPC 順に入れなおす
	let sorted_epc_list = Object.keys(data['elProperties']);
	sorted_epc_list.sort();
	let new_props = {};
	sorted_epc_list.forEach((epc) => {
		new_props[epc] = data['elProperties'][epc];
	});
	data['elProperties'] = new_props;

	return data;
};

DeviceDescription.prototype._selectOneOfByRelease = function (data, release) {
	if (!data) {
		return data;
	}

	let d = JSON.parse(JSON.stringify(data));

	if (Array.isArray(d)) {
		for (let i = 0; i < d.length; i++) {
			d[i] = this._selectOneOfByRelease(d[i], release);
		}
	} else if (typeof (d) === 'object') {
		if ('oneOf' in d) {
			let list = [];
			d['oneOf'].forEach((el) => {
				if ('validRelease' in el) {
					if (!this._isValidRelease(el['validRelease'], release)) {
						return;
					}
				}
				el = this._selectOneOfByRelease(el, release);
				list.push(el);
			});
			if (list.length === 1) {
				d = list[0];
			} else {
				d = { oneOf: list };
			}
		} else {
			Object.keys(d).forEach((k) => {
				d[k] = this._selectOneOfByRelease(d[k], release);
			});
		}
	}
	return d;
};

DeviceDescription.prototype._isValidRelease = function (valid_release, release) {
	let from = valid_release['from'];
	let to = valid_release['to'];
	if (!(from && to)) {
		return false;
	}

	from = from.toUpperCase();
	to = to.toUpperCase();

	if (!/^[A-Z]$/.test(from)) {
		from = 'A';
	}
	if (!/^[A-Z]$/.test(to)) {
		to = this._standard_version;
	}
	if (release >= from && release <= to) {
		return true;
	} else {
		return false;
	}
};

/* ------------------------------------------------------------------
* getRelease()
* DeviceDescription のリリースバージョンを返す
* ---------------------------------------------------------------- */
DeviceDescription.prototype.getRelease = function () {
	return this._standard_version
};

/* ------------------------------------------------------------------
* getMetaData()
* DeviceDescription のメタ情報を返す
*
* {
*   "date":"2019-09-13",
*   "release":"L",
*   "version":"3.1.4"
* }
* ---------------------------------------------------------------- */
DeviceDescription.prototype.getMetaData = function () {
	return JSON.parse(JSON.stringify(this._meta_data));
};

/* ------------------------------------------------------------------
* getReleaseList()
* 有効なリリースバージョンのリストを返す
* - ダッシュボード用
* ---------------------------------------------------------------- */
DeviceDescription.prototype.getReleaseList = function () {
	let v = this._standard_version;
	let latest_code = v.charCodeAt(0);
	let list = [];
	for (let code = 0x41; code <= latest_code; code++) {
		list.push(String.fromCharCode(code));
	}
	return list;
};

const mDeviceDescription = new DeviceDescription();
mDeviceDescription.init();
module.exports = mDeviceDescription;
