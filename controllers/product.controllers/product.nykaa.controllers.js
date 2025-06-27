// filename: nykaaProxy.js
import express from "express";
import { get } from "axios";
const app = express();
const PORT = 3005;

app.get("/nykaa", async (req, res) => {
  const url =
    "https://www.nykaafashion.com/rest/appapi/V2/categories/products?PageSize=36&filter_format=v2&apiVersion=5&currency=INR&country_code=IN&deviceType=WEBSITE&sort=popularity&device_os=desktop&categoryId=3&currentPage=2&sort_algo=default";

  try {
    const response = await get(url, {
      headers: {
        domain: "NYKAA_FASHION",
        "sec-ch-ua-platform": '"Windows"',
        "x-csrf-token": "lZbv5kmuwzJ3zwiB",
        Referer: "https://www.nykaafashion.com/women/westernwear/c/3?...",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0...)",
        "sec-ch-ua":
          '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        Accept: "*/*",
        "Cache-Control": "no-cache",
        Cookie:
          "_abck=B48918CD7CCF652CE14C2766AEF714B1~-1~YAAQTHLBF+gsPF+XAQAAv0kXbQ6ghe32id+Har6eSrqeE2FWnagPOv1Ni0g/z5wpAgAFOs0HH1tkrY78h2B2+Gt1VFdtM5Gasv778fwcSYqkhnfOtVlHgTfGx/vYAznSflU4fgp9z5L+ed8E5zvVtwnywNdS/qjUVdAodIUCYZSQpFFFeDSnSatRN+T+RXxt6kh/E9zFOffJ5xiayyR5Jh1oQQbR/yv2IQnh60hTzH1g/ZDBoISoyT/04IFc5C7idjkj43YtTnhP9z6fn+VriR69h3vm+SM6HDt/3ddEA23gGHd0w99Xnt9sJ4u+2+F+FMXWrh+8tJ6DK4AwqrQdbhQdZuzt+5TVJnBa7MpAEsRkaDGHrnffZOwwt9EtaZOfRlLESonc4Ur53NM++GpIPZ+ptMRXZa+98lYgx4dxQfQJ9YE8JnfSKmaf37cmdWj5rDyBLrbqxsALZi3LOT7LOjs382XRnm8XY0PcHDTdPP7ZO3unpsRY3N9JoROgnQKux1826mpHXmpv4F8+drtwTvyHUHh7HWHgYX/zZnkAQsuPEv3tuiMU2sItTR1Y806OJiZuuO7bo73iz+p3HWkn0Eh0c0QrvzwIDS69PEFOUO3gK6zrrCMqrDPqgoz5OROZJqSJiEKIjSI279K1qd9w9vJGlm/DBg3UAT3Yl0E5mY3I8NmsbObgrPK/GND9HK35RzapmYu8GdGNQzI=~0~-1~1749884902; bm_sz=605409E29B808E76058FF5EDC4A26218~YAAQTHLBF18MO1+XAQAAESoMbRytdWamut0MhkdiMlvpMa9PTsWY/QNYevi2ITuwHXzvoVBwyF2M/3FK2qf34Gk+jehRqPsQbFsfgx5nYama6fPKbh+7q9r4oI+XOf/MMn6DE0tOMO9Y6M2ngrvjkz6Re1N8NuotYpayGpsrOYr6l/38q86HcibEuC7w8U2Xx6kByhZE6aDPpCEkbTyeMCinC6upqgO+tS+uhNHhmuLs/IjDm4UJrQCIEvffyUsWvssraIYSXHZPZgr3mxStMWCcCQhaooIyypz77DkHvjuJnvcFyeudaW4FlcrV+rOTH0jY6BHPzl6kiWXjsahcWej/nL2zCpIpKJf69L2gvIQDMDQHB/BkqTrm~3224388~4276546",
      },
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
