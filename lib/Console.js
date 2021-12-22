/* ------------------------------------------------------------------
* Console.js
* コンソール出力
*
* Date: 2018-11-03
* ---------------------------------------------------------------- */
'use strict';
const mFs = require('fs');
const mPath = require('path');

const Console = function (params) {
	// 色の定義
	this._COLORS = {
		red     : '\x1b[31m',
		green   : '\x1b[32m',
		yellow  : '\x1b[33m',
		blue    : '\x1b[34m',
		magenta : '\x1b[35m',
		cyan    : '\x1b[36m',
		white   : '\x1b[37m',
		reset   : '\x1b[0m'
	};

	// カーソルの位置
	this._current_pos = 0;

	// ASCII アートテキストのファイルパス
	this._ASCII_ART_TEXT_PATH = mPath.resolve(__dirname, '../conf/start_logo_aa.txt');
};

/* ------------------------------------------------------------------
* printStartLogoAsciiArt()
* システム起動時用の ASCII アートを出力
*
* - elemu/conf/start_logo_aa.txt の内容を出力する
* - 上記テキストファイルが存在しなければ何も表示しない
*
* 引数:
*   なし
*
* 戻値:
*   なし
* ---------------------------------------------------------------- */
Console.prototype.printStartLogoAsciiArt = function () {
	let text = '';
	try {
		text = mFs.readFileSync(this._ASCII_ART_TEXT_PATH);
	} catch(error) {
		// Do nothing
	}
	if(text) {
		console.log(this._COLORS['cyan'] + text + this._COLORS['reset']);
	}
};

Console.prototype.printVersion = function (version) {
	console.log('Version ' + version);
	console.log('');
};

Console.prototype.printDeviceDescriptionMetaData = function (data) {
	console.log('Device Description');
	console.log('- Date   : ' + data['date']);
	console.log('- Release: ' + data['release']);
	console.log('- Version: ' + data['version']);
	console.log('');
};

/* ------------------------------------------------------------------
* printSysInitMsg(msg)
* システム起動に関連したメッセージ出力
*
* - 後に処理結果 (OK or NG) を同じ行に出力することを想定しているため、
*   改行を入れずにメッセージを出力する
* - 後に必ず printSysInitRes() を呼び出すこと。
*
* 引数:
*   - msg   | String | required | メッセージ文字列
*
* 戻値:
*   なし
* ---------------------------------------------------------------- */
Console.prototype.printSysInitMsg = function (msg) {
	this._printSysPrefix();
	process.stdout.write(msg);
	this._current_pos += msg.length;
};

Console.prototype._printSysPrefix = function () {
	let C = this._COLORS;
	process.stdout.write('[' + C['yellow'] + 'SY' + C['reset'] + '] ');
	this._current_pos = 5;
};


/* ------------------------------------------------------------------
* printSysInitRes(res)
* システム起動の結果出力
*
* - コンソールの右端に [  OK ] などの結果を表示する。
* - 最後に改行を入れる。
*
* 引数:
*   - res   | String | required | "OK" または "NG"
*
* 戻値:
*   なし
* ---------------------------------------------------------------- */
Console.prototype.printSysInitRes = function (res) {
	let C = this._COLORS;
	let w = process.stdout.columns;
	let white_spece_len = w - this._current_pos - 9;
	if(white_spece_len > 0) {
		let white_spaces = '';
		for(let i=0; i<white_spece_len; i++) {
			white_spaces += ' ';
		}
		process.stdout.write(white_spaces);
	}

	if(res === 'OK') {
		console.log('[  ' + C['green'] + 'OK' + C['reset'] + '  ] ');
	} else {
		console.log('[  ' + C['red'] + 'NG' + C['reset'] + '  ] ');
	}

	this._current_pos = 0;
};

/* ------------------------------------------------------------------
* printSysInfo(msg)
* システムに関連したメッセージ出力
*
* - 改行を入れてメッセージを出力する
*
* 引数:
*   - msg   | String | required | メッセージ文字列
*
* 戻値:
*   なし
* ---------------------------------------------------------------- */
Console.prototype.printSysInfo = function (msg) {
	this._printSysPrefix();
	console.log(msg);
};


/* ------------------------------------------------------------------
* printPacketRx(address, hex)
* パケットの受信内容を出力する
*
* - 改行を入れてメッセージを出力する
*
* 引数:
*   - address | String | required | IP アドレス
*   - hex     | String | required | パケットの 16 進数文字列
*
* 戻値:
*   なし
* ---------------------------------------------------------------- */
Console.prototype.printPacketRx = function (address, hex) {
	this._printPacketRxPrefix();
	console.log('From : ' + address);
	console.log('     ' + hex);
};

Console.prototype._printPacketRxPrefix = function (dir) {
	let C = this._COLORS;
	process.stdout.write('[' + C['magenta'] + 'RX' + C['reset'] + '] ');
	this._current_pos = 5;
};


/* ------------------------------------------------------------------
* printPacketTx(address, hex)
* パケットの送信内容を出力する
*
* 引数:
*   - address | String | required | IP アドレス
*   - hex     | String | required | パケットの 16 進数文字列
*
* 戻値:
*   なし
* ---------------------------------------------------------------- */
Console.prototype.printPacketTx = function (address, hex) {
	this._printPacketTxPrefix();
	console.log('To   : ' + address);
	console.log('     ' + hex);
};

Console.prototype._printPacketTxPrefix = function (dir) {
	let C = this._COLORS;
	process.stdout.write('[' + C['cyan'] + 'TX' + C['reset'] + '] ');
	this._current_pos = 5;
};


/* ------------------------------------------------------------------
* printError(msg, error)
* エラーを出力する
*
* 引数:
*   - msg   | String | required | メッセージ
*   - error | Error  | required | Error オブジェクト
*
* 戻値:
*   なし
* ---------------------------------------------------------------- */
Console.prototype.printError = function (msg, error) {
	let C = this._COLORS;
	process.stdout.write('[' + C['red'] + 'ER' + C['reset'] + '] ');
	console.log(msg);
	console.error(error);
};

module.exports = Console;
