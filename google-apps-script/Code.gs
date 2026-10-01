const SHEET_NAME = 'Регистрация на турнир';
const HEADERS = ['Дата регистрации', 'Никнейм VRChat', 'Лётное звание', 'Должность'];

function doPost(e) {
  const parameters = e && e.parameter ? e.parameter : {};
  const nonce = typeof parameters.submissionNonce === 'string'
    && /^[a-f0-9-]{36}$/i.test(parameters.submissionNonce)
    ? parameters.submissionNonce
    : '';

  try {
    const nickname = cleanField_(parameters.nickname, 40);
    const flightRank = cleanField_(parameters.flightRank, 80);
    const position = cleanField_(parameters.position || '', 80);

    if (!nonce || !nickname || !flightRank || parameters.website) {
      throw new Error('Некорректные данные формы');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      if (!spreadsheet) throw new Error('Скрипт должен быть привязан к таблице');

      let sheet = spreadsheet.getSheetByName(SHEET_NAME);
      if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
      if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

      sheet.appendRow([
        new Date(),
        safeCellText_(nickname),
        safeCellText_(flightRank),
        safeCellText_(position),
      ]);
    } finally {
      lock.releaseLock();
    }

    return response_(nonce, true);
  } catch (error) {
    console.error('Ошибка регистрации на турнир:', error);
    return response_(nonce, false);
  }
}

function cleanField_(value, maxLength) {
  if (typeof value !== 'string') return '';
  const cleaned = value.trim();
  if (cleaned.length > maxLength) return '';
  return cleaned;
}

function safeCellText_(value) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function response_(nonce, success) {
  const result = JSON.stringify({
    type: 'tournament-registration',
    nonce: nonce,
    success: success,
  });
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><body><script>window.parent.postMessage('
      + result
      + ', "*");</script></body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
