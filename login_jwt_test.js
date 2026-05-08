import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

/* ================= CONFIG ================= */
const START_USER = 100;
const END_USER = 1019;
const TOTAL_USERS = END_USER - START_USER + 1;

/* ================= USER DATA ================= */
// giả sử bạn có sẵn 1000 user trong DB
// const users = Array.from({ length: TOTAL_USERS }, (_, i) => ({
//     username: `canhan${START_USER + i}`,
//     password: "@Vnpt123",
// }));

// Mỗi user đăng nhập liên tục trong 30s
// export const options = {
//     vus: TOTAL_USERS,
//     duration: "30s",    // giữ tải trong 30 giây
//     thresholds: {
//         http_req_duration: ["p(95)<1000"], // 95% request < 1s
//         http_req_failed: ["rate<0.01"],    // lỗi < 1%
//     },
// };

// 900 login / s
export const options = {
    scenarios: {
        login_burst_900: {
            executor: "constant-arrival-rate",
            rate: 900,
            timeUnit: "1s",
            duration: "1s",
            preAllocatedVUs: 1000,
            maxVUs: 1000,
        },
    },
};

const users = new SharedArray("users", () =>
    Array.from({ length: TOTAL_USERS }, (_, i) => ({
        username: `canhan${START_USER + i}`,
        password: "@Vnpt123",
    }))
);
/* ================= TEST ================= */
export default function () {
    const user = users[__ITER];

    const url = "https://daugia-kiemthu.vnptnghean.com.vn/api/Account/Login";

    if (!user) return;

    const payload = JSON.stringify({
        Username: user.username,
        Password: user.password,
    });

    const params = {
        headers: {
            "Content-Type": "application/json",
        },
        timeout: "10s",
    };
    const res = http.post(url, payload, params);

    // kiểm tra kết quả
    const checks = check(res, {
        "status is 200 or 401": (r) =>
            r.status === 200 || r.status === 401,

        // "JWT token returned": (r) => {
        //     if (r.status !== 200) return true;
        //     const body = r.json();
        //     return body.Data && body.Data.TOKEN && body.Data.TOKEN.length > 2;
        // },
    });

    // Log user bị lỗi
    if (!checks || res.status >= 400) {
        console.log(`[FAIL] User: ${user.username} | Status: ${res.status} | Error: ${res.error}`);
    }
}

// k6 run login_jwt_test.js
