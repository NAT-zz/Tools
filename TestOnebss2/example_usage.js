/**
 * example_usage.js
 * Hủy đặt cọc (OneBSS)
 * Trang: https://onebss.vnpt.vn/#/ext-hopdong/huy-dat-coc
 *
 * Steps:
 *   1. Đăng nhập
 *   2. Vào trang Hủy đặt cọc
 *   3–6. Tick Người giới thiệu → chọn VNPT012132 → Chấp nhận
 *   7. Chọn Dịch vụ: Băng rộng cố định
 *   8. Nhập Số máy/Acc + Enter → chờ grid load
 *   9. Click hàng đầu tiên → nhập Ngày thoái
 *   B. Ghi lại  C. Thanh toán  D. Bỏ tick Loại hóa đơn
 *   E. Thanh toán (popup)  F. Xác nhận 1  G. Xác nhận 2
 *   H. Đóng form  I. Hoàn thiện  J. Xác nhận
 *
 * Chạy: node example_usage.js
 */

import { appendFileSync, existsSync, readFileSync } from "fs";
import { By, createBrowser, Key, until } from "./selenium_tool.js";

/* ================================================================
   FILE PATHS
   ================================================================ */
const SOMAY_FILE = "./somay.txt";
const DONE_FILE = "./done.txt";
const ERROR_LOG = "./error_rows.txt";
const ERROR_THUEBAO = "./error_thuebao.txt";

/* ================================================================
   CẤU HÌNH
   ================================================================ */
const CONFIG = {
    url: "https://onebss.vnpt.vn",
    username: "anhtuancntt.nan",
    password: "H#x8x3at",
    targetUrl: "https://onebss.vnpt.vn/#/ext-hopdong/huy-dat-coc",
    dichVu: "Băng rộng cố định",
    ngayThoai: "01/06/2026",
    maNhanVien: "VNPT012132",
    // Bắt đầu từ số máy này (bỏ qua tất cả trước nó). Để null để chạy từ đầu.
    startFrom: null,
};

/* ================================================================
   LOG HELPERS
   ================================================================ */
function logError(soMay, reason) {
    const ts = new Date().toISOString();
    const detail = `${ts} | Số máy/Acc: ${soMay} | Lỗi: ${reason}\n`;
    appendFileSync(ERROR_LOG, detail, "utf8");
    appendFileSync(ERROR_THUEBAO, `${soMay}\n`, "utf8");
    console.error(`[ERROR] ${soMay} → ${reason}`);
}

function markDone(soMay) {
    appendFileSync(DONE_FILE, `${soMay}\n`, "utf8");
}

/* ================================================================
   SESSION
   ================================================================ */
async function ensureLoggedIn(browser) {
    const url = await browser.currentUrl();
    if (url.includes("/auth/login")) {
        console.log("[SESSION] Session hết hạn → đăng nhập lại...");
        try {
            await browser.loginManual({
                url: CONFIG.url,
                username: CONFIG.username,
                password: CONFIG.password,
            });
        } catch {
            console.error("[SESSION] Timeout chờ OTP — thoát.");
            process.exit(1);
        }
    }
}

/* ================================================================
   HELPERS
   ================================================================ */

async function waitForGridLoad(browser) {
    try {
        await browser.driver.wait(async () =>
            await browser.driver.executeScript(
                `return !!document.querySelector('.e-spinner-pane:not(.e-spin-hide)')`
            ),
            3_000
        );
    } catch { /* spinner chưa kịp hiện */ }
    try {
        await browser.driver.wait(async () =>
            await browser.driver.executeScript(
                `const all = document.querySelectorAll('.e-spinner-pane');
                 return all.length === 0 ||
                        Array.from(all).every(el => el.classList.contains('e-spin-hide'));`
            ),
            15_000
        );
    } catch { /* timeout */ }
    await browser.sleep(500);
}

async function waitForDangNap(browser) {
    await browser.sleep(300);
    try {
        await browser.driver.wait(async () => {
            const els = await browser.driver.findElements(
                By.xpath(`//*[contains(text(),'Đang nạp nội dung')]`)
            );
            if (els.length === 0) return true;
            for (const el of els) {
                try {
                    const vis = await browser.driver.executeScript(
                        `const s = getComputedStyle(arguments[0]);
                         return s.display !== 'none' && s.visibility !== 'hidden' && !!arguments[0].offsetParent;`,
                        el
                    );
                    if (vis) return false;
                } catch { /* stale */ }
            }
            return true;
        }, 30_000);
    } catch { /* không có spinner */ }
}

async function checkGhiLaiError(browser) {
    await browser.sleep(1500);
    return await browser.driver.executeScript(`
        const all = document.querySelectorAll('.toast, .alert, [class*="toastr"], [class*="notification"], [class*="snack"], [class*="Vue-Toastification"]');
        for (const t of all) {
            const s = getComputedStyle(t);
            if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') continue;
            const txt = (t.textContent || '').trim();
            if (txt && (t.className.includes('error') || t.className.includes('danger') ||
                txt.includes('kh\u00f4ng th\u1ec3') || txt.includes('ch\u01b0a ho\u00e0n thi\u1ec7n') ||
                txt.includes('kh\u00f4ng t\u1ed3n t\u1ea1i') || txt.includes('Kh\u00f4ng t\u00ecm th\u1ea5y') ||
                txt.includes('kh\u00f4ng h\u1ee3p l\u1ec7') || txt.includes('b\u1ea1n kh\u00f4ng th\u1ec3') ||
                txt.includes('kh\u00f4ng th\u1ec3 l\u1eadp h\u1ee3p \u0111\u1ed3ng'))) {
                return txt.substring(0, 150);
            }
        }
        return null;
    `);
}

async function closePopups(browser) {
    try {
        await browser.driver.executeScript(`
            document.querySelectorAll('.Vue-Toastification__close-button').forEach(b => b.click());
            document.querySelectorAll('.modal.show .close, .modal.show [data-dismiss="modal"]')
                     .forEach(b => b.click());
            document.querySelectorAll('.e-dlg-closeicon-btn').forEach(b => b.click());
        `);
        await browser.sleep(500);
    } catch { /* bỏ qua */ }
}

async function refreshAndCheckOTP(browser) {
    console.log("[F5] Làm mới trang kiểm tra OTP...");
    await browser.reload();
    await browser.sleep(2000);
    const url = await browser.currentUrl();
    if (url.includes("/auth/login")) {
        console.log("[F5] Phát hiện cần nhập lại OTP → đăng nhập lại...");
        try {
            await browser.loginManual({
                url: CONFIG.url,
                username: CONFIG.username,
                password: CONFIG.password,
            });
        } catch {
            console.error("[F5] Timeout chờ OTP — thoát.");
            process.exit(1);
        }
    }
}

// Bước 3–6: Tick Người giới thiệu và chọn nhân viên
async function checkNguoiGioiThieu(browser) {
    const isChecked = await browser.driver.executeScript(
        `const el = document.querySelector('input.check'); return el ? el.checked : false;`
    );
    if (!isChecked) {
        await browser.jsClick("input.check");
        console.log("[B3] Đã tick Người giới thiệu, chờ popup...");

        await browser.waitForVisible(".popup-body.control-ngt", 10_000);
        console.log("[B4] Popup đã mở.");

        const rowXpath = `//div[contains(@class,'popup-body')]//table//tbody/tr[.//td[normalize-space(text())='${CONFIG.maNhanVien}']]`;
        const row = await browser.findByXpath(rowXpath);
        await row.click();
        await browser.sleep(300);
        console.log(`[B5] Đã chọn ${CONFIG.maNhanVien}.`);

        const chapNhanXpath = `//*[contains(@class,'popup-body') or contains(@class,'popup-header')]//*[normalize-space(text())='Chấp nhận']`;
        const chapNhanBtn = await browser.findByXpath(chapNhanXpath);
        await chapNhanBtn.click();
        await browser.sleep(1000);
        console.log("[B6] Đã click Chấp nhận.");
    } else {
        console.log("[B3] Người giới thiệu đã tick sẵn.");
    }
}

// Bước 7: Chọn Dịch vụ
async function selectDichVu(browser) {
    await browser.sleep(1000);
    await browser.selectSelect2(1, CONFIG.dichVu);
    try {
        await browser.waitForHidden(".loading, .spinner, .blockUI, .e-spinner-pane", 8_000);
    } catch { /* không có spinner */ }
    await browser.waitForVisible("input.form-control.highlight", 15_000);
    console.log("[B7] Đã chọn Dịch vụ:", CONFIG.dichVu);
}

// Bước 8: Nhập Số máy/Acc + Enter + chờ grid load
async function nhapSoMay(browser, soMay) {
    const inputs = await browser.findAllByCss("input.form-control.highlight");
    const input = inputs[1]; // index 1 = Số máy/Acc
    await input.clear();
    await input.sendKeys(soMay, Key.ENTER);
    console.log("[B8] Đã nhập Số máy/Acc:", soMay);
    await waitForGridLoad(browser);
}

// Đếm số hàng trong bảng đặt cọc (có cột "Mã GD")
async function countDatCocRows(browser) {
    return parseInt(await browser.driver.executeScript(`
        const grids = document.querySelectorAll('div.e-grid');
        for (const g of grids) {
            const ths = g.querySelectorAll('.e-headercontent th');
            if (!Array.from(ths).some(h => h.textContent.includes('M\u00e3 GD'))) continue;
            return g.querySelectorAll('.e-gridcontent tbody tr.e-row').length;
        }
        return 0;
    `)) || 0;
}

// Bước 9: Nhập Ngày thoái (sau khi chọn row để tránh bị reset)
async function nhapNgayThoai(browser) {
    const dpEl = await browser.findById("ej2-datepicker_2");
    await browser.driver.executeScript("arguments[0].removeAttribute('readonly');", dpEl);
    await dpEl.click();
    await browser.sleep(300);
    await dpEl.clear();
    await dpEl.sendKeys(CONFIG.ngayThoai, Key.TAB);
    await browser.sleep(200);
    console.log("[B9] Đã nhập Ngày thoái:", CONFIG.ngayThoai);
}

// Bước B: Click "Ghi lại" + kiểm tra lỗi + chờ spinner
async function clickGhiLai(browser) {
    const ghiLaiXpath =
        `//button[contains(normalize-space(.),'Ghi lại')] | ` +
        `//a[contains(normalize-space(.),'Ghi lại')]`;
    await browser.driver.wait(until.elementLocated(By.xpath(ghiLaiXpath)), 10_000);
    const ghiLaiEl = await browser.driver.findElement(By.xpath(ghiLaiXpath));
    await browser.driver.wait(until.elementIsVisible(ghiLaiEl), 5_000);
    await browser.driver.executeScript("arguments[0].click();", ghiLaiEl);
    console.log("[B-B] Đã click Ghi lại.");

    const err = await checkGhiLaiError(browser);
    if (err) throw new Error(`Ghi lại lỗi: ${err}`);

    await waitForDangNap(browser);

    const successEls = await browser.driver.findElements(
        By.xpath(`//*[contains(normalize-space(.),'thành công')]`)
    );
    if (successEls.length > 0) {
        const msg = await successEls[0].getText().catch(() => "");
        console.log(`[B-B] Ghi lại → "${msg.trim()}"`);
    } else {
        console.log("[B-B] Ghi lại xong.");
    }
}

// Bước C: Click "Thanh toán" trên toolbar chính + chờ form load
async function clickThanhToanMain(browser) {
    const ttBtn = await browser.driver.wait(
        until.elementLocated(By.xpath(
            `//ul[contains(@class,'list')]//a[normalize-space(.)='Thanh toán' and @href='javascript:void(0)'] |` +
            `//ul[contains(@class,'list')]//a[@href='javascript:void(0)'][.//*[contains(@class,'shopping-credit')] or normalize-space(.)='Thanh toán']`
        )),
        10_000
    );
    await browser.driver.executeScript("arguments[0].click();", ttBtn);
    await browser.sleep(500);
    console.log("[B-C] Đã click Thanh toán (toolbar).");

    await browser.driver.wait(
        until.elementLocated(By.xpath(
            `//*[contains(@class,'e-dlg-content') or contains(@class,'popupComponentPayment')]` +
            `//*[contains(.,'Loại hoá đơn') or contains(.,'Loại hóa đơn')]`
        )),
        15_000
    );
    await waitForDangNap(browser);

    await browser.driver.wait(async () => {
        const els = await browser.driver.findElements(
            By.xpath(`//*[contains(text(),'Tên khách hàng')]/following-sibling::* | //*[normalize-space(@placeholder)='Tên khách hàng']`)
        );
        for (const el of els) {
            try {
                const val = (await el.getText()) || (await el.getAttribute("value"));
                if (val && val.trim()) return true;
            } catch { /* stale */ }
        }
        const totals = await browser.driver.findElements(
            By.xpath(`//*[contains(text(),'Tổng tiền trả')]/following::input[1] | //*[contains(text(),'Tổng tiền trả')]/following::*[self::input or self::span][1]`)
        );
        for (const el of totals) {
            try {
                const val = (await el.getText()) || (await el.getAttribute("value"));
                if (val && val.trim() && val.trim() !== "0") return true;
            } catch { /* stale */ }
        }
        return false;
    }, 20_000);
    await browser.sleep(500);
    console.log("[B-C] Form Thanh toán HĐ đã load xong.");
}

// Bước D: Bỏ tick "Loại hóa đơn"
async function boTickLoaiHoaDon(browser) {
    try {
        const input = await browser.driver.wait(
            until.elementLocated(By.xpath(
                `//*[contains(@class,'e-dlg-content') or contains(@class,'popupComponentPayment')]` +
                `//div[contains(@class,'check-action')]` +
                `[.//*[contains(@class,'name') and (contains(.,'Loại hoá đơn') or contains(.,'Loại hóa đơn'))]]` +
                `//input[@type='checkbox']`
            )),
            5_000
        );
        const isChecked = await browser.driver.executeScript(`return arguments[0].checked;`, input);
        console.log(`[B-D] Loại hóa đơn checked=${isChecked}`);
        if (isChecked) {
            await browser.driver.executeScript("arguments[0].scrollIntoView({block:'center'});", input);
            await browser.sleep(200);
            await input.click();
            await browser.sleep(400);
            const after = await browser.driver.executeScript(`return arguments[0].checked;`, input);
            if (after) {
                await browser.driver.executeScript("arguments[0].click();", input);
                await browser.sleep(300);
            }
            console.log("[B-D] Đã bỏ tick Loại hóa đơn.");
        } else {
            console.log("[B-D] Loại hóa đơn đã bỏ tick sẵn.");
        }
    } catch (e) {
        console.warn(`[B-D] Không tìm thấy checkbox Loại hóa đơn: ${e.message}`);
    }
}

// Bước E: Click "Thanh toán" trong popup
async function clickThanhToanPopup(browser) {
    const btn = await browser.driver.wait(
        until.elementLocated(By.xpath(
            `//*[contains(@class,'e-dlg-content') or contains(@class,'popupComponentPayment')]` +
            `//ul[contains(@class,'list')]//a[@href='javascript:void(0)']` +
            `[normalize-space(.)='Thanh toán' or contains(normalize-space(.),'Thanh toán')]`
        )),
        15_000
    );
    await browser.driver.executeScript("arguments[0].click();", btn);
    console.log("[B-E] Đã click Thanh toán trong popup.");
}

// Bước F: Xác nhận dialog 1 "Bạn xác nhận thanh toán hợp đồng này?"
async function xacNhanDialog1(browser) {
    const btn = await browser.driver.wait(
        until.elementLocated(By.xpath(
            `//div[contains(@class,'modal') and contains(@class,'show')]` +
            `//*[contains(@class,'modal-footer')]//button[contains(@class,'btn-primary')]`
        )),
        15_000
    );
    await browser.driver.executeScript("arguments[0].scrollIntoView({block:'center'});", btn);
    await browser.driver.executeScript("arguments[0].click();", btn);
    console.log("[B-F] Xác nhận dialog lần 1.");
}

// Bước G: Xác nhận dialog 2 "Bạn có muốn thanh toán cho các thuê bao này không?"
async function xacNhanDialog2(browser) {
    try {
        await browser.sleep(1000);
        await browser.driver.wait(async () => {
            return await browser.driver.executeScript(`
                const modals = document.querySelectorAll('.modal.show');
                for (const m of modals) {
                    if (m.textContent.includes('thu\u00ea bao')) {
                        const btn = m.querySelector('footer.modal-footer .btn-primary, .modal-footer .btn-primary');
                        if (btn) { btn.click(); return true; }
                    }
                }
                return false;
            `);
        }, 10_000);
        console.log("[B-G] Xác nhận dialog lần 2.");
    } catch {
        await browser.sleep(1000);
        console.log("[B-G] Không có dialog lần 2.");
    }
}

// Bước H: Đóng form Thanh toán (click X) + chờ form ẩn
async function dongFormThanhToan(browser) {
    await browser.sleep(500);
    const closeBtn = await browser.driver.wait(
        until.elementLocated(By.xpath(
            `//div[contains(@class,'e-dialog')]//div[contains(@class,'e-dlg-header-content')]` +
            `//button[@title='Close' or @aria-label='Close']`
        )),
        10_000
    );
    await browser.driver.executeScript("arguments[0].click();", closeBtn);
    await browser.sleep(800);
    console.log("[B-H] Đã click X đóng form Thanh toán.");

    await browser.driver.wait(async () => {
        const dlgs = await browser.driver.findElements(
            By.xpath(`//div[contains(@class,'e-dlg-content')]//div[contains(@class,'popupComponentPayment')]`)
        );
        if (dlgs.length === 0) return true;
        for (const el of dlgs) {
            const visible = await browser.driver.executeScript(
                `const s = getComputedStyle(arguments[0]);
                 return s.display !== 'none' && s.visibility !== 'hidden' && arguments[0].offsetParent !== null;`,
                el
            );
            if (visible) return false;
        }
        return true;
    }, 15_000);
    await browser.sleep(3000);
    console.log("[B-H] Form Thanh toán đã đóng.");
}

// Bước I + J: Click "Hoàn thiện" + xác nhận dialog
async function clickHoanThienVaXacNhan(browser) {
    const btn = await browser.driver.wait(
        until.elementLocated(By.xpath(
            `//div[contains(@class,'frm-thaydoi-datcoc-huy') or contains(@class,'list-actions-top')]` +
            `//ul[contains(@class,'list')]//a[@href='javascript:void(0)']` +
            `[normalize-space(.)='Hoàn thiện' or contains(normalize-space(.),'Hoàn thiện')]`
        )),
        25_000
    );
    await browser.sleep(2000);
    await browser.driver.executeScript("arguments[0].click();", btn);
    console.log("[B-I] Đã click Hoàn thiện.");
    await browser.sleep(2000);

    await browser.driver.wait(async () => {
        return await browser.driver.executeScript(`
            const modals = document.querySelectorAll('.modal.show');
            for (const m of modals) {
                if (getComputedStyle(m).display === 'none') continue;
                const btn = m.querySelector('.modal-footer .btn-primary');
                if (btn && !btn.disabled) { btn.click(); return true; }
            }
            return false;
        `);
    }, 30_000);
    console.log("[B-J] Đã click Đồng ý. ✓ Hoàn thành.");
    await browser.sleep(2000);
}

/* ================================================================
   MAIN
   ================================================================ */
async function main() {
    const soMayList = readFileSync(SOMAY_FILE, "utf8")
        .split(/\r?\n/).map(l => l.trim())
        .filter(l => l && l.toUpperCase() !== "MA_TB");

    let pending = soMayList;
    if (CONFIG.startFrom) {
        const idx = pending.indexOf(CONFIG.startFrom);
        if (idx > 0) {
            console.log(`[INFO] startFrom "${CONFIG.startFrom}" → bỏ qua ${idx} số máy trước đó.`);
            pending = pending.slice(idx);
        } else if (idx === -1) {
            console.warn(`[WARN] startFrom "${CONFIG.startFrom}" không tìm thấy trong danh sách.`);
        }
    }
    console.log(`[INFO] Tổng: ${soMayList.length} | Còn lại: ${pending.length}`);

    if (pending.length === 0) {
        console.log("[INFO] Không còn Số máy/Acc nào cần xử lý.");
        return;
    }

    const browser = await createBrowser({ headless: false, timeout: 20_000 });

    try {
        await browser.loginManual({
            url: CONFIG.url,
            username: CONFIG.username,
            password: CONFIG.password,
        });
        console.log("[LOGIN] Đăng nhập thành công:", await browser.currentUrl());

        for (const soMay of pending) {
            console.log(`\n[SOMAY] ════ ${soMay} ════`);
            const t0 = Date.now();

            try {
                await ensureLoggedIn(browser);

                // Bước 2: Vào trang Hủy đặt cọc
                await browser.goto(CONFIG.targetUrl);
                await browser.waitForVisible(".select2-container", 15_000);
                await browser.sleep(800);
                console.log("[B2] Đã vào trang Hủy đặt cọc.");

                // Bước 3–6: Người giới thiệu
                await checkNguoiGioiThieu(browser);

                // Bước 7: Dịch vụ
                await selectDichVu(browser);

                // Bước 8: Nhập Số máy/Acc + chờ grid
                await nhapSoMay(browser, soMay);

                const rowCount = await countDatCocRows(browser);
                console.log(`[B8] Danh sách đặt cọc: ${rowCount} hàng.`);

                if (rowCount === 0) {
                    console.log(`[B8] Không có đặt cọc cho ${soMay} — bỏ qua.`);
                    markDone(soMay);
                    await refreshAndCheckOTP(browser);
                    continue;
                }

                // Click hàng đầu tiên
                const firstRow = await browser.driver.wait(
                    until.elementLocated(By.xpath(
                        `//div[contains(@class,'e-gridcontent')]//tbody/tr[contains(@class,'e-row')][1]`
                    )),
                    10_000
                );
                await browser.driver.executeScript("arguments[0].click();", firstRow);
                await browser.sleep(200);
                console.log("[B8] Đã click hàng đầu tiên.");

                // Bước 9: Ngày thoái
                await nhapNgayThoai(browser);
                await browser.sleep(1000);

                // Bước B–J: xử lý hàng
                try {
                    await clickGhiLai(browser);
                    await waitForGridLoad(browser);
                    await clickThanhToanMain(browser);
                    await boTickLoaiHoaDon(browser);
                    await clickThanhToanPopup(browser);
                    await waitForGridLoad(browser);
                    await xacNhanDialog1(browser);
                    await xacNhanDialog2(browser);
                    await dongFormThanhToan(browser);
                    await waitForGridLoad(browser);
                    await clickHoanThienVaXacNhan(browser);
                    await waitForGridLoad(browser);

                    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
                    console.log(`[OK] Xong ${soMay} (${elapsed}s)`);
                    markDone(soMay);
                } catch (rowErr) {
                    console.error(`[ROW LỖI] ${soMay}: ${rowErr.message}`);
                    logError(soMay, rowErr.message.substring(0, 250));
                    await closePopups(browser);
                }

                await refreshAndCheckOTP(browser);

            } catch (err) {
                const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
                console.error(`[SOMAY LỖI] ${soMay}: ${err.message} (${elapsed}s)`);
                logError(soMay, err.message.substring(0, 250));
                try {
                    await refreshAndCheckOTP(browser);
                } catch { /* bỏ qua */ }
            }
        }

        console.log("\n[DONE] Hoàn thành xử lý tất cả Số máy/Acc.");

    } catch (fatalErr) {
        console.error("[FATAL]", fatalErr.message);
    } finally {
        // await browser.close();
        console.log("[INFO] Trình duyệt vẫn mở. Nhấn Ctrl+C để thoát.");
    }
}

main();


