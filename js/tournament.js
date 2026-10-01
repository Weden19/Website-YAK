const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwbIeruQQ4WD7wqdhN8oGkRWITVBxiP-trugEa777ckikSJQL2Ukcc_9kRPma9ytrLnAg/exec';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('tournamentRegistrationForm');
    const submitButton = document.getElementById('registrationSubmit');
    const status = document.getElementById('registrationStatus');
    const config = document.getElementById('registrationConfig');
    const frame = document.getElementById('registrationFrame');
    const nonceInput = document.getElementById('submissionNonce');
    const endpointIsConfigured = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(GOOGLE_APPS_SCRIPT_URL);
    let pendingNonce = null;
    let timeoutId = null;

    if (!endpointIsConfigured) {
        config.textContent = 'Форма пока не подключена к таблице. Администратору сайта нужно развернуть Google Apps Script и указать URL веб-приложения в js/tournament.js.';
        config.classList.add('registration-config--warning');
        return;
    }

    form.action = GOOGLE_APPS_SCRIPT_URL;
    submitButton.disabled = false;

    form.addEventListener('submit', () => {
        pendingNonce = crypto.randomUUID();
        nonceInput.value = pendingNonce;
        submitButton.disabled = true;
        status.textContent = 'Отправляем заявку…';
        status.classList.remove('form-status--error', 'form-status--success');
        timeoutId = window.setTimeout(() => {
            pendingNonce = null;
            submitButton.disabled = false;
            status.textContent = 'Не удалось подтвердить отправку. Проверьте соединение и попробуйте ещё раз.';
            status.classList.add('form-status--error');
        }, 30000);
    });

    window.addEventListener('message', event => {
        if (event.source !== frame.contentWindow || !pendingNonce) return;
        if (!event.data || event.data.type !== 'tournament-registration' || event.data.nonce !== pendingNonce) return;

        window.clearTimeout(timeoutId);
        pendingNonce = null;
        submitButton.disabled = false;

        if (event.data.success === true) {
            form.reset();
            status.textContent = 'Заявка отправлена. Спасибо за регистрацию!';
            status.classList.add('form-status--success');
        } else {
            status.textContent = 'Не удалось сохранить заявку. Попробуйте позже или сообщите организаторам.';
            status.classList.add('form-status--error');
        }
    });
});
