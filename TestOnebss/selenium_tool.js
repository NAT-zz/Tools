/**
 * selenium_tool.js
 * Công cụ tự động hóa web sử dụng Selenium WebDriver (Edge)
 * Hỗ trợ: điều hướng, thao tác form, screenshot, scraping, kiểm tra UI
 */

import { exec } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";
import { Builder, By, Key, Select, until } from "selenium-webdriver";
import edge from "selenium-webdriver/edge.js";

/* ================================================================
   CONFIG MẶC ĐỊNH
   ================================================================ */
const DEFAULT_TIMEOUT = 10_000; // ms
const DEFAULT_SCREENSHOT_DIR = "./screenshots";

/* ================================================================
   CLASS CHÍNH
   ================================================================ */
export class SeleniumTool {
    /**
     * @param {object} options
     * @param {boolean} [options.headless=false]   - Chạy ẩn không mở cửa sổ
     * @param {number}  [options.timeout=10000]    - Timeout mặc định (ms)
     * @param {string}  [options.screenshotDir]    - Thư mục lưu screenshot
     * @param {string}  [options.downloadDir]      - Thư mục download file
     */
    constructor(options = {}) {
        this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
        this.screenshotDir = options.screenshotDir ?? DEFAULT_SCREENSHOT_DIR;
        this.headless = options.headless ?? false;
        this.downloadDir = options.downloadDir ?? null;
        this.driver = null;
    }

    /* ----------------------------------------------------------------
       KHỞI TẠO & ĐÓNG TRÌNH DUYỆT
       ---------------------------------------------------------------- */

    /** Mở trình duyệt Edge */
    async open() {
        const edgeOptions = new edge.Options();

        if (this.headless) {
            edgeOptions.addArguments("--headless=new");
        }
        edgeOptions.addArguments("--start-maximized");
        edgeOptions.addArguments("--disable-blink-features=AutomationControlled");
        edgeOptions.addArguments("--no-sandbox");
        edgeOptions.addArguments("--disable-dev-shm-usage");

        if (this.downloadDir) {
            const prefs = {
                "download.default_directory": path.resolve(this.downloadDir),
                "download.prompt_for_download": false,
                "download.directory_upgrade": true,
            };
            edgeOptions.setUserPreferences(prefs);
        }

        this.driver = await new Builder()
            .forBrowser("MicrosoftEdge")
            .setEdgeOptions(edgeOptions)
            .build();

        await this.driver.manage().setTimeouts({ implicit: this.timeout });
        console.log("[SeleniumTool] Trình duyệt Edge đã mở.");
        return this;
    }

    /** Đóng trình duyệt */
    async close() {
        if (this.driver) {
            await this.driver.quit();
            this.driver = null;
            console.log("[SeleniumTool] Đã đóng trình duyệt.");
        }
    }

    /* ----------------------------------------------------------------
       ĐIỀU HƯỚNG
       ---------------------------------------------------------------- */

    /** Truy cập URL */
    async goto(url) {
        await this.driver.get(url);
        console.log(`[Nav] Đã truy cập: ${url}`);
    }

    /** Lấy URL hiện tại */
    async currentUrl() {
        return await this.driver.getCurrentUrl();
    }

    /** Lấy tiêu đề trang */
    async title() {
        return await this.driver.getTitle();
    }

    /** Quay lại trang trước */
    async back() {
        await this.driver.navigate().back();
    }

    /** Tiến đến trang tiếp theo */
    async forward() {
        await this.driver.navigate().forward();
    }

    /** Tải lại trang */
    async reload() {
        await this.driver.navigate().refresh();
    }

    /* ----------------------------------------------------------------
       TÌM PHẦN TỬ (trả về WebElement)
       ---------------------------------------------------------------- */

    /** Tìm theo CSS selector */
    async findByCss(selector) {
        return await this.driver.findElement(By.css(selector));
    }

    /** Tìm nhiều phần tử theo CSS selector */
    async findAllByCss(selector) {
        return await this.driver.findElements(By.css(selector));
    }

    /** Tìm theo XPath */
    async findByXpath(xpath) {
        return await this.driver.findElement(By.xpath(xpath));
    }

    /** Tìm theo id */
    async findById(id) {
        return await this.driver.findElement(By.id(id));
    }

    /** Tìm theo name attribute */
    async findByName(name) {
        return await this.driver.findElement(By.name(name));
    }

    /** Tìm theo nội dung text (link) */
    async findByLinkText(text) {
        return await this.driver.findElement(By.linkText(text));
    }

    /** Tìm theo nội dung text một phần (link) */
    async findByPartialLinkText(text) {
        return await this.driver.findElement(By.partialLinkText(text));
    }

    /* ----------------------------------------------------------------
       CHỜ PHẦN TỬ
       ---------------------------------------------------------------- */

    /** Chờ phần tử xuất hiện và hiển thị */
    async waitForVisible(cssSelector, timeout = this.timeout) {
        const el = await this.driver.wait(
            until.elementLocated(By.css(cssSelector)),
            timeout
        );
        await this.driver.wait(until.elementIsVisible(el), timeout);
        return el;
    }

    /** Chờ phần tử biến mất */
    async waitForHidden(cssSelector, timeout = this.timeout) {
        const el = await this.driver.findElement(By.css(cssSelector));
        await this.driver.wait(until.elementIsNotVisible(el), timeout);
    }

    /** Chờ URL chứa chuỗi cụ thể */
    async waitForUrl(urlPart, timeout = this.timeout) {
        await this.driver.wait(until.urlContains(urlPart), timeout);
    }

    /** Chờ tiêu đề chứa chuỗi cụ thể */
    async waitForTitle(titlePart, timeout = this.timeout) {
        await this.driver.wait(until.titleContains(titlePart), timeout);
    }

    /** Chờ cố định (ms) — dùng hạn chế */
    async sleep(ms) {
        await new Promise((r) => setTimeout(r, ms));
    }

    /* ----------------------------------------------------------------
       THAO TÁC CLICK
       ---------------------------------------------------------------- */

    /** Click theo CSS selector */
    async click(cssSelector) {
        const el = await this.waitForVisible(cssSelector);
        await el.click();
    }

    /** Click phần tử bằng JavaScript (dùng khi bị che khuất) */
    async jsClick(cssSelector) {
        const el = await this.findByCss(cssSelector);
        await this.driver.executeScript("arguments[0].click();", el);
    }

    /** Double click */
    async doubleClick(cssSelector) {
        const el = await this.waitForVisible(cssSelector);
        const actions = this.driver.actions({ async: true });
        await actions.doubleClick(el).perform();
    }

    /** Right click */
    async rightClick(cssSelector) {
        const el = await this.waitForVisible(cssSelector);
        const actions = this.driver.actions({ async: true });
        await actions.contextClick(el).perform();
    }

    /* ----------------------------------------------------------------
       THAO TÁC NHẬP LIỆU
       ---------------------------------------------------------------- */

    /**
     * Nhập text vào input (xóa nội dung cũ trước)
     * @param {string} cssSelector
     * @param {string} text
     */
    async type(cssSelector, text) {
        const el = await this.waitForVisible(cssSelector);
        await el.clear();
        await el.sendKeys(text);
    }

    /** Nhập text không xóa nội dung cũ */
    async append(cssSelector, text) {
        const el = await this.waitForVisible(cssSelector);
        await el.sendKeys(text);
    }

    /** Xóa nội dung input */
    async clear(cssSelector) {
        const el = await this.waitForVisible(cssSelector);
        await el.clear();
    }

    /** Nhấn phím (ví dụ: Key.ENTER, Key.TAB, Key.ESCAPE) */
    async pressKey(cssSelector, key) {
        const el = await this.waitForVisible(cssSelector);
        await el.sendKeys(key);
    }

    /** Upload file vào input[type=file] */
    async uploadFile(cssSelector, filePath) {
        const el = await this.driver.findElement(By.css(cssSelector));
        await el.sendKeys(path.resolve(filePath));
    }

    /* ----------------------------------------------------------------
       DROPDOWN / SELECT
       ---------------------------------------------------------------- */

    /** Chọn option theo text hiển thị */
    async selectByText(cssSelector, text) {
        const el = await this.waitForVisible(cssSelector);
        const select = new Select(el);
        await select.selectByVisibleText(text);
    }

    /** Chọn option theo value */
    async selectByValue(cssSelector, value) {
        const el = await this.waitForVisible(cssSelector);
        const select = new Select(el);
        await select.selectByValue(value);
    }

    /** Chọn option theo index (bắt đầu từ 0) */
    async selectByIndex(cssSelector, index) {
        const el = await this.waitForVisible(cssSelector);
        const select = new Select(el);
        await select.selectByIndex(index);
    }

    /** Lấy tất cả các options của select */
    async getSelectOptions(cssSelector) {
        const el = await this.waitForVisible(cssSelector);
        const select = new Select(el);
        const options = await select.getOptions();
        return Promise.all(options.map((o) => o.getText()));
    }

    /* ----------------------------------------------------------------
       LẤY THÔNG TIN PHẦN TỬ
       ---------------------------------------------------------------- */

    /** Lấy text nội dung phần tử */
    async getText(cssSelector) {
        const el = await this.waitForVisible(cssSelector);
        return await el.getText();
    }

    /** Lấy giá trị attribute */
    async getAttribute(cssSelector, attribute) {
        const el = await this.findByCss(cssSelector);
        return await el.getAttribute(attribute);
    }

    /** Lấy giá trị CSS property */
    async getCssValue(cssSelector, property) {
        const el = await this.findByCss(cssSelector);
        return await el.getCssValue(property);
    }

    /** Kiểm tra phần tử có tồn tại không */
    async exists(cssSelector) {
        const els = await this.driver.findElements(By.css(cssSelector));
        return els.length > 0;
    }

    /** Kiểm tra phần tử có hiển thị không */
    async isVisible(cssSelector) {
        try {
            const el = await this.driver.findElement(By.css(cssSelector));
            return await el.isDisplayed();
        } catch {
            return false;
        }
    }

    /** Kiểm tra checkbox/radio có được chọn không */
    async isChecked(cssSelector) {
        const el = await this.findByCss(cssSelector);
        return await el.isSelected();
    }

    /* ----------------------------------------------------------------
       CUỘN TRANG
       ---------------------------------------------------------------- */

    /** Cuộn đến phần tử */
    async scrollTo(cssSelector) {
        const el = await this.findByCss(cssSelector);
        await this.driver.executeScript(
            "arguments[0].scrollIntoView({ behavior: 'smooth', block: 'center' });",
            el
        );
    }

    /** Cuộn xuống cuối trang */
    async scrollToBottom() {
        await this.driver.executeScript(
            "window.scrollTo(0, document.body.scrollHeight);"
        );
    }

    /** Cuộn lên đầu trang */
    async scrollToTop() {
        await this.driver.executeScript("window.scrollTo(0, 0);");
    }

    /* ----------------------------------------------------------------
       JAVASCRIPT
       ---------------------------------------------------------------- */

    /** Thực thi JavaScript tùy ý, trả về kết quả */
    async runScript(script, ...args) {
        return await this.driver.executeScript(script, ...args);
    }

    /** Thực thi JS bất đồng bộ */
    async runAsyncScript(script, ...args) {
        return await this.driver.executeAsyncScript(script, ...args);
    }

    /* ----------------------------------------------------------------
       ALERT / CONFIRM / PROMPT
       ---------------------------------------------------------------- */

    /** Chờ alert và accept (OK) */
    async acceptAlert() {
        await this.driver.wait(until.alertIsPresent(), this.timeout);
        const alert = await this.driver.switchTo().alert();
        await alert.accept();
    }

    /** Chờ alert và dismiss (Cancel) */
    async dismissAlert() {
        await this.driver.wait(until.alertIsPresent(), this.timeout);
        const alert = await this.driver.switchTo().alert();
        await alert.dismiss();
    }

    /** Lấy text của alert */
    async getAlertText() {
        await this.driver.wait(until.alertIsPresent(), this.timeout);
        const alert = await this.driver.switchTo().alert();
        return await alert.getText();
    }

    /** Nhập text vào prompt rồi accept */
    async sendAlertText(text) {
        await this.driver.wait(until.alertIsPresent(), this.timeout);
        const alert = await this.driver.switchTo().alert();
        await alert.sendKeys(text);
        await alert.accept();
    }

    /* ----------------------------------------------------------------
       IFRAME
       ---------------------------------------------------------------- */

    /** Chuyển vào iframe theo CSS selector */
    async switchToIframe(cssSelector) {
        const el = await this.waitForVisible(cssSelector);
        await this.driver.switchTo().frame(el);
    }

    /** Chuyển vào iframe theo index */
    async switchToIframeByIndex(index) {
        await this.driver.switchTo().frame(index);
    }

    /** Thoát khỏi iframe, quay về frame gốc */
    async switchToDefault() {
        await this.driver.switchTo().defaultContent();
    }

    /* ----------------------------------------------------------------
       TAB / CỬA SỔ
       ---------------------------------------------------------------- */

    /** Mở tab mới */
    async openNewTab(url = "about:blank") {
        await this.driver.switchTo().newWindow("tab");
        if (url !== "about:blank") await this.goto(url);
    }

    /** Lấy danh sách handle các tab đang mở */
    async getAllTabs() {
        return await this.driver.getAllWindowHandles();
    }

    /** Chuyển sang tab theo index */
    async switchToTab(index) {
        const handles = await this.getAllTabs();
        await this.driver.switchTo().window(handles[index]);
    }

    /** Đóng tab hiện tại và quay về tab trước */
    async closeCurrentTab() {
        await this.driver.close();
        const handles = await this.getAllTabs();
        await this.driver.switchTo().window(handles[handles.length - 1]);
    }

    /* ----------------------------------------------------------------
       COOKIE
       ---------------------------------------------------------------- */

    /** Lấy tất cả cookie */
    async getCookies() {
        return await this.driver.manage().getCookies();
    }

    /** Lấy một cookie theo tên */
    async getCookie(name) {
        return await this.driver.manage().getCookie(name);
    }

    /** Thêm cookie */
    async addCookie(cookie) {
        await this.driver.manage().addCookie(cookie);
    }

    /** Xóa tất cả cookie */
    async clearCookies() {
        await this.driver.manage().deleteAllCookies();
    }

    /* ----------------------------------------------------------------
       SCREENSHOT
       ---------------------------------------------------------------- */

    /**
     * Chụp màn hình và lưu file
     * @param {string} [filename] - Tên file (không cần đuôi .png). Mặc định dùng timestamp.
     * @returns {string} Đường dẫn file đã lưu
     */
    async screenshot(filename) {
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
        const name = filename ?? `screenshot_${Date.now()}`;
        const filePath = path.join(this.screenshotDir, `${name}.png`);
        const data = await this.driver.takeScreenshot();
        fs.writeFileSync(filePath, data, "base64");
        console.log(`[Screenshot] Đã lưu: ${filePath}`);
        return filePath;
    }

    /* ----------------------------------------------------------------
       SCRAPING TIỆN ÍCH
       ---------------------------------------------------------------- */

    /**
     * Lấy text của tất cả phần tử khớp selector
     * @param {string} cssSelector
     * @returns {string[]}
     */
    async getAllTexts(cssSelector) {
        const els = await this.driver.findElements(By.css(cssSelector));
        return Promise.all(els.map((el) => el.getText()));
    }

    /**
     * Lấy attribute của tất cả phần tử khớp selector
     * @param {string} cssSelector
     * @param {string} attribute
     * @returns {string[]}
     */
    async getAllAttributes(cssSelector, attribute) {
        const els = await this.driver.findElements(By.css(cssSelector));
        return Promise.all(els.map((el) => el.getAttribute(attribute)));
    }

    /**
     * Lấy dữ liệu bảng HTML (table) thành mảng object
     * @param {string} tableSelector - CSS selector của <table>
     * @returns {object[]}
     */
    async scrapeTable(tableSelector) {
        const headers = await this.getAllTexts(`${tableSelector} thead th`);
        const rows = await this.driver.findElements(
            By.css(`${tableSelector} tbody tr`)
        );
        const result = [];
        for (const row of rows) {
            const cells = await row.findElements(By.css("td"));
            const cellTexts = await Promise.all(cells.map((c) => c.getText()));
            const obj = {};
            headers.forEach((h, i) => {
                obj[h] = cellTexts[i] ?? "";
            });
            result.push(obj);
        }
        return result;
    }

    /* ----------------------------------------------------------------
       ĐĂNG NHẬP TIỆN ÍCH
       ---------------------------------------------------------------- */

    /**
     * Thực hiện đăng nhập form cơ bản
     * @param {object} params
     * @param {string} params.url
     * @param {string} params.usernameSelector
     * @param {string} params.passwordSelector
     * @param {string} params.submitSelector
     * @param {string} params.username
     * @param {string} params.password
     * @param {string} [params.successUrlPart]  - Chờ URL chứa chuỗi này sau login
     */
    async login({ url, usernameSelector, passwordSelector, submitSelector, username, password, successUrlPart }) {
        await this.goto(url);
        await this.type(usernameSelector, username);
        await this.type(passwordSelector, password);
        await this.click(submitSelector);
        if (successUrlPart) {
            await this.waitForUrl(successUrlPart);
        }
        console.log(`[Login] Đã đăng nhập với tài khoản: ${username}`);
    }

    /**
     * Đăng nhập 2 bước: username/password → OTP gửi về điện thoại/email
     * Hệ thống tự động chờ form OTP xuất hiện, nhắc nhập mã qua terminal.
     *
     * @param {object} params
     * @param {string}  params.url
     * @param {string}  params.usernameSelector        - Mặc định: input[placeholder='Tài khoản']
     * @param {string}  params.passwordSelector        - Mặc định: input[name='password']
     * @param {string}  params.loginSubmitSelector     - Mặc định: button.btn-login
     * @param {string}  params.otpInputSelector        - Mặc định: input[placeholder='Mã OTP']
     * @param {string}  params.otpSubmitSelector       - Mặc định: button.btn-primary
     * @param {string}  [params.otpResendSelector]     - Nút gửi lại OTP
     * @param {string}  params.username
     * @param {string}  params.password
     * @param {string}  [params.successUrlPart]        - Chuỗi trong URL sau khi đăng nhập xong
     * @param {number}  [params.otpWaitTimeout=30000]  - Thời gian chờ form OTP (ms)
     */
    async loginWithOTP({
        url,
        usernameSelector = "input[placeholder='Tài khoản']",
        passwordSelector = "input[name='password']",
        loginSubmitSelector = "button.btn-login",
        otpInputSelector = "input[placeholder='Mã OTP']",
        otpSubmitSelector = "button.btn-primary",
        otpResendSelector,
        username,
        password,
        successUrlPart,
        otpWaitTimeout = 30_000,
    }) {
        // Bước 1: Điền username / password
        await this.goto(url);
        await this.type(usernameSelector, username);
        await this.type(passwordSelector, password);
        await this.click(loginSubmitSelector);
        console.log(`[Login] Đã submit, chờ form OTP...`);

        // Bước 2: Chờ form OTP xuất hiện
        await this.waitForVisible(otpInputSelector, otpWaitTimeout);
        console.log(`[OTP] Form OTP đã xuất hiện.`);

        // Bước 3: Nhắc nhập OTP qua terminal
        if (otpResendSelector) {
            const resend = await this.promptUser(
                "[OTP] Nhấn Enter để dùng mã đã nhận, hoặc gõ 'resend' rồi Enter để gửi lại: "
            );
            if (resend.toLowerCase() === "resend") {
                await this.jsClick(otpResendSelector);
                await this.sleep(1000);
                console.log("[OTP] Đã gửi lại mã OTP.");
            }
        }

        const otp = await this.promptUser("[OTP] Nhập mã OTP: ");

        // Bước 4: Điền OTP và xác nhận
        await this.type(otpInputSelector, otp);
        await this.click(otpSubmitSelector);
        console.log("[OTP] Đã submit OTP, chờ kết quả...");

        // Bước 5: Chờ URL thành công
        if (successUrlPart) {
            await this.waitForUrl(successUrlPart, otpWaitTimeout);
        } else {
            await this.sleep(3000);
        }

        console.log(`[Login] Đăng nhập thành công: ${username}`);
    }

    /**
     * Đăng nhập tự động điền username/password, sau đó CHỜ người dùng
     * tự nhập OTP trên trình duyệt. Khi URL không còn chứa loginUrlPart
     * thì coi là đăng nhập xong và tự tiếp tục.
     *
     * @param {object} params
     * @param {string}  params.url
     * @param {string}  params.username
     * @param {string}  params.password
     * @param {string}  [params.usernameSelector]   - Mặc định: input[placeholder='Tài khoản']
     * @param {string}  [params.passwordSelector]   - Mặc định: input[name='password']
     * @param {string}  [params.submitSelector]     - Mặc định: button.btn-login
     * @param {string}  [params.otpInputSelector]   - Chờ form OTP xuất hiện trước khi báo sẵn sàng
     * @param {string}  [params.loginUrlPart]       - Phần URL trang login, mặc định: /auth/login
     * @param {number}  [params.otpTimeout=120000]  - Timeout chờ nhập OTP (ms), mặc định 2 phút
     */
    async loginManual({
        url,
        username,
        password,
        usernameSelector = "input[placeholder='Tài khoản']",
        passwordSelector = "input[name='password']",
        submitSelector = "button.btn-login",
        otpInputSelector = "input[placeholder='Mã OTP']",
        loginUrlPart = "/auth/login",
        otpTimeout = 120_000,
    }) {
        await this.goto(url);
        await this.type(usernameSelector, username);
        await this.type(passwordSelector, password);
        await this.click(submitSelector);
        console.log("[Login] Đã submit username/password, chờ form OTP...");

        // Chờ form OTP xuất hiện
        await this.waitForVisible(otpInputSelector, 30_000);
        console.log("[OTP] Form OTP đã xuất hiện. Vui lòng nhập mã OTP trên trình duyệt...");

        // Chờ URL rời khỏi trang login (người dùng tự nhập OTP và xác nhận)
        await this.driver.wait(
            async () => {
                const u = await this.driver.getCurrentUrl();
                return !u.includes(loginUrlPart);
            },
            otpTimeout,
            `Timeout ${otpTimeout / 1000}s: Chưa hoàn thành xác thực OTP.`
        );

        console.log("[Login] Đăng nhập thành công:", await this.driver.getCurrentUrl());
    }

    /**
     * Đăng nhập form có CAPTCHA — chụp ảnh captcha, mở cho người dùng xem,
     * đọc mã từ stdin, rồi submit. Hỗ trợ thử lại khi captcha sai.
     *
     * @param {object} params
     * @param {string}  params.url
     * @param {string}  params.usernameSelector
     * @param {string}  params.passwordSelector
     * @param {string}  params.captchaImageSelector   - CSS selector của thẻ <img> captcha
     * @param {string}  params.captchaInputSelector   - CSS selector của input nhập captcha
     * @param {string}  params.submitSelector
     * @param {string}  params.username
     * @param {string}  params.password
     * @param {string}  [params.successUrlPart]       - Chuỗi kiểm tra trong URL sau login thành công
     * @param {string}  [params.errorSelector]        - CSS selector thông báo lỗi captcha sai
     * @param {string}  [params.captchaRefreshSelector] - Nút làm mới captcha (nếu có)
     * @param {number}  [params.maxRetries=3]         - Số lần thử lại tối đa
     */
    async loginWithCaptcha({
        url,
        usernameSelector,
        passwordSelector,
        captchaImageSelector,
        captchaInputSelector,
        submitSelector,
        username,
        password,
        successUrlPart,
        errorSelector,
        captchaRefreshSelector,
        maxRetries = 3,
    }) {
        await this.goto(url);
        await this.type(usernameSelector, username);
        await this.type(passwordSelector, password);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`\n[Captcha] Lần thử ${attempt}/${maxRetries}`);

            // Làm mới captcha từ lần 2 trở đi (nếu có nút refresh)
            if (attempt > 1 && captchaRefreshSelector) {
                try {
                    await this.click(captchaRefreshSelector);
                    await this.sleep(800);
                } catch { /* bỏ qua nếu không tìm thấy */ }
            }

            // Chụp và mở ảnh captcha
            const captchaPath = await this.screenshotElement(
                captchaImageSelector,
                `captcha_attempt_${attempt}`
            );
            this._openFile(captchaPath);
            console.log(`[Captcha] Ảnh đã lưu tại: ${captchaPath}`);

            // Đọc captcha từ người dùng nhập vào terminal
            const code = await this.promptUser("[Captcha] Nhập mã captcha: ");

            // Điền captcha và submit
            await this.type(captchaInputSelector, code);
            await this.click(submitSelector);

            // Chờ kết quả
            await this.sleep(1500);

            // Kiểm tra URL thành công
            const currentUrl = await this.currentUrl();
            if (successUrlPart && currentUrl.includes(successUrlPart)) {
                console.log(`[Login] Đăng nhập thành công: ${username}`);
                return;
            }

            // Kiểm tra thông báo lỗi
            if (errorSelector) {
                const hasError = await this.isVisible(errorSelector);
                if (hasError) {
                    const errText = await this.getText(errorSelector).catch(() => "");
                    console.warn(`[Login] Captcha sai hoặc lỗi: ${errText}`);
                    if (attempt < maxRetries) continue;
                }
            }

            // Nếu không có errorSelector, kiểm tra URL có thay đổi không
            if (!successUrlPart) {
                console.log(`[Login] Đã submit, URL hiện tại: ${currentUrl}`);
                return;
            }

            if (attempt === maxRetries) {
                throw new Error(`[Login] Đăng nhập thất bại sau ${maxRetries} lần thử.`);
            }
        }
    }

    /**
     * Chụp screenshot của một phần tử cụ thể (crop từ screenshot toàn trang)
     * @param {string} cssSelector
     * @param {string} [filename]
     * @returns {string} Đường dẫn file
     */
    async screenshotElement(cssSelector, filename) {
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }

        await this.scrollTo(cssSelector);
        await this.sleep(300);

        const el = await this.waitForVisible(cssSelector);
        const rect = await this.driver.executeScript(
            "const r = arguments[0].getBoundingClientRect(); " +
            "return { x: r.left, y: r.top, w: r.width, h: r.height };",
            el
        );

        const dpr = await this.driver.executeScript("return window.devicePixelRatio || 1;");
        const fullBase64 = await this.driver.takeScreenshot();
        const cropped = await this.driver.executeAsyncScript(
            `
            const [b64, x, y, w, h, dpr, cb] = arguments;
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width  = Math.round(w * dpr);
                canvas.height = Math.round(h * dpr);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img,
                    Math.round(x * dpr), Math.round(y * dpr),
                    Math.round(w * dpr), Math.round(h * dpr),
                    0, 0,
                    Math.round(w * dpr), Math.round(h * dpr)
                );
                cb(canvas.toDataURL('image/png').split(',')[1]);
            };
            img.src = 'data:image/png;base64,' + b64;
            `,
            fullBase64, rect.x, rect.y, rect.w, rect.h, dpr
        );

        const name = filename ?? `element_${Date.now()}`;
        const filePath = path.join(this.screenshotDir, `${name}.png`);
        fs.writeFileSync(filePath, cropped, "base64");
        return filePath;
    }

    /**
     * Hiển thị câu hỏi trên terminal và chờ người dùng nhập
     * @param {string} question
     * @returns {Promise<string>}
     */
    promptUser(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        return new Promise((resolve) => {
            process.stdout.write(question);
            rl.once("line", (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
    }

    /**
     * Mở file bằng ứng dụng mặc định của hệ điều hành (Windows)
     * @param {string} filePath
     */
    _openFile(filePath) {
        const abs = path.resolve(filePath);
        exec(`start "" "${abs}"`, (err) => {
            if (err) console.warn(`[openFile] Không mở được file: ${err.message}`);
        });
    }

    /**
     * Chọn option trong dropdown Select2 bằng cách tìm theo text hiển thị.
     * @param {number} containerIndex  - Vị trí (0-based) của .select2-container trên trang
     * @param {string} optionText      - Text của option cần chọn (so khớp chính xác)
     * @param {number} [timeout]       - Timeout chờ dropdown mở
     */
    async selectSelect2(containerIndex, optionText, timeout = this.timeout) {
        // Click vào container để mở dropdown
        const containers = await this.driver.findElements(By.css('.select2-container'));
        if (containerIndex >= containers.length) {
            throw new Error(`[Select2] Không tìm thấy container index ${containerIndex} (total: ${containers.length})`);
        }
        await containers[containerIndex].click();

        // Chờ search input của select2 xuất hiện
        const searchInput = await this.driver.wait(
            until.elementLocated(By.css('.select2-search__field')),
            timeout
        );
        await this.driver.wait(until.elementIsVisible(searchInput), timeout);
        await searchInput.clear();
        await searchInput.sendKeys(optionText);
        await this.sleep(400);

        // Chờ options xuất hiện rồi click đúng option
        await this.driver.wait(
            until.elementLocated(By.css('.select2-results__option')),
            timeout
        );
        const options = await this.driver.findElements(By.css('.select2-results__option'));
        for (const opt of options) {
            const text = await opt.getText();
            if (text.trim() === optionText) {
                await opt.click();
                console.log(`[Select2] Đã chọn: "${optionText}"`);
                return;
            }
        }
        // Nếu không khớp chính xác, click option đầu tiên không phải "searching..."
        for (const opt of options) {
            const text = await opt.getText();
            if (text.includes(optionText)) {
                await opt.click();
                console.log(`[Select2] Đã chọn (gần đúng): "${text}"`);
                return;
            }
        }
        throw new Error(`[Select2] Không tìm thấy option: "${optionText}"`);
    }
}

/* ================================================================
   EXPORT KEY CONSTANTS
   ================================================================ */
export { By, Key, until };

/* ================================================================
   HÀM TIỆN ÍCH — tạo nhanh instance
   ================================================================ */

/**
 * Tạo và mở trình duyệt Edge ngay lập tức
 * @param {object} options - Xem constructor SeleniumTool
 * @returns {SeleniumTool}
 */
export async function createBrowser(options = {}) {
    const tool = new SeleniumTool(options);
    await tool.open();
    return tool;
}
