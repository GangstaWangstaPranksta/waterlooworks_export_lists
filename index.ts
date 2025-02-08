import type { Page, Target } from "puppeteer";

interface Listing {
  id: string;
  title: string;
  employer: string;
  city: string;
  location: string;
  province: string;
  term: string;
  length: string;
  summary?: string;
  responsibilities?: string;
  skills?: string;
  compensation?: string;
}

import { parseArgs } from "util";
import converter from "json-2-csv";
import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  browser: "chrome",
  headless: false,
  defaultViewport: null,
  args: ["--window-size=1280,800"],
  //executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});

let listingsArr: Listing[] = [];
let pages: Page[] = [];

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    username: {
      type: "string",
    },
    password: {
      type: "string",
    },
  },
  strict: true,
  allowPositionals: true,
});

async function extractListingDetails(
  newPage: Page,
  listing: Listing
): Promise<void> {
  const keys: string[] = [
    "Job - City:",
    "Job - Province/State:",
    "Employment Location Arrangement:",
    "Work Term Duration:",
    "Job Summary:",
    "Job Responsibilities:",
    "Required Skills:",
    "Compensation and Benefits:",
  ];

  const keyToPropertyMap: { [key: string]: keyof Listing } = {
    [keys[0]]: "city",
    [keys[1]]: "province",
    [keys[2]]: "location",
    [keys[3]]: "length",
    [keys[4]]: "summary",
    [keys[5]]: "responsibilities",
    [keys[6]]: "skills",
    [keys[7]]: "compensation",
  };

  try {
    const tableLength = await newPage.evaluate(() => {
      const tbody = document.querySelectorAll("tbody")[1]; // Select correct tbody
      return tbody ? tbody.children.length : 0; // Handle case where tbody might not exist
    });

    for (let i = 1; i <= tableLength; i++) {
      const keyValuePair = await newPage.evaluate(
        (i: number, keys: string[]) => {
          const keyElement = document.querySelector(
            `#postingDiv > div:nth-child(1) > div.panel-body > table > tbody > tr:nth-child(${i}) > td:nth-child(1)`
          );
          const valueElement = document.querySelector(
            `#postingDiv > div:nth-child(1) > div.panel-body > table > tbody > tr:nth-child(${i}) > td:nth-child(2)`
          );

          let keyText =
            keyElement?.textContent?.match(/[^\t][A-z].+/g)?.[0] || "";
          let valueText = valueElement?.innerText || "";

          return { key: keyText, value: valueText };
        },
        i,
        keys
      );

      if (keys.includes(keyValuePair.key)) {
        const propertyName = keyToPropertyMap[keyValuePair.key];
        if (propertyName) {
          listing[propertyName] = keyValuePair.value;
        }
      }
    }
  } catch (error) {
    console.error("Error in extractListingDetails:", error); // Basic error logging, improve as needed
  }
}

browser.on("targetcreated", async (target: Target) => {
  if (target.type() === "page") {
    const newPage = await target.page();
    if (!newPage) {
      return;
    }
    if (newPage.url() !== "about:blank") {
      pages.push(newPage); // Add the new page to the list
      let listing: Listing = {
        id: "",
        title: "",
        employer: "",
        city: "",
        province: "",
        location: "",
        term: "",
        length: "",
      };

      try {
        await newPage.waitForSelector("#postingDiv");

        listing.id = await newPage.evaluate(() => {
          const element = document.querySelectorAll("div h1")[1];
          return element?.textContent?.match(/\d+/g)?.[0] || "";
        });

        listing.title = await newPage.evaluate(() => {
          const element = document.querySelector(
            "#postingDiv > div:nth-child(1) > div.panel-body > table > tbody > tr:nth-child(3) > td:nth-child(2) > span"
          );
          return element?.textContent?.match(/[^\t][A-z].+/g)?.[0] || "";
        });

        listing.term = await newPage.evaluate(() => {
          const element = document.querySelector(
            "#postingDiv > div:nth-child(1) > div.panel-body > table > tbody > tr:nth-child(1) > td:nth-child(2)"
          );
          return element?.textContent?.match(/[0-9[A-z].+/g)?.[0] || "";
        });

        listing.employer = await newPage.evaluate(() => {
          const element = document.querySelector("div h2");
          return element?.textContent?.match(/[A-z].+/g)?.[0] || "";
        });

        await extractListingDetails(newPage, listing);

        listingsArr.push(listing);
        pages = pages.filter((page) => page !== newPage);
        await newPage.close();
      } catch (error) {
        console.error("Error processing new page:", error, newPage.url()); // Log error and page URL for debugging
        // Decide how to handle errors: skip listing, retry, etc. For now, just logging and closing page.
        if (newPage && !newPage.isClosed()) {
          // Check if page is still valid before closing
          await newPage.close();
        }
      }
    }
  }
});

let jobsIdArray: string[] = [];

// open a page and wait until url is the job page
const page = await browser.newPage();
await page.goto("https://waterlooworks.uwaterloo.ca/waterloo.htm?action=login");
console.log("Atempting to login...");
{
  let username, password;
  if (values.username && values.password) {
    username = values.username;
    password = values.password;
  } else if (process.env.WAT_IM_USERNAME && process.env.WAT_IM_PASSWORD) {
    username = process.env.WAT_IM_USERNAME;
    password = process.env.WAT_IM_PASSWORD;
  }
  if (username && password) {
    //let errorElement = await page.$("span#errorText");
    await page.waitForSelector("#userNameInput");
    await page.type("#userNameInput", `${username}@uwaterloo.ca`);
    await page.keyboard.press("Enter");
    await page.waitForSelector("#passwordInput");
    await page.type("#passwordInput", password);
    await page.keyboard.press("Enter");
    await page.waitForNavigation({ waitUntil: "networkidle0" });
    if (page.url().startsWith("https://adfs.uwaterloo.ca/adfs/ls/")) {
      console.log("Login failed. Exiting...");
      await page.close();
      await browser.close();
      process.exit(1);
    }
    console.log("Log in successful, waiting for 2FA...");
  } else {
    console.log("Login information not found. Manually login to continue.");
  }
}

while (
  page.url() !==
  "https://waterlooworks.uwaterloo.ca/myAccount/co-op/full/jobs.htm"
) {
  if (
    page.url() === "https://waterlooworks.uwaterloo.ca/myAccount/dashboard.htm"
  ) {
    console.log("Logged in.");
    console.log("Redirected to dashboard...");
    console.log("Going to job page...");
    await page.goto(
      "https://waterlooworks.uwaterloo.ca/myAccount/co-op/full/jobs.htm"
    );
  } else {
    await Bun.sleep(10);
  }
}
await page.goto(
  "https://waterlooworks.uwaterloo.ca/myAccount/co-op/full/jobs.htm"
);

await page.evaluate(() => {
  // Create a div element
  const largeElement = document.createElement("div");

  // Set the text content
  largeElement.textContent = "Check the command line!";

  // Set the styles for the element
  largeElement.style.position = "fixed"; // Make sure it's fixed in the viewport
  largeElement.style.top = "50%"; // Center vertically
  largeElement.style.left = "50%"; // Center horizontally
  largeElement.style.transform = "translate(-50%, -50%)"; // Center exactly in the middle
  largeElement.style.fontSize = "100px"; // Large text
  largeElement.style.fontWeight = "bold"; // Bold text
  largeElement.style.color = "red"; // Set the text color
  largeElement.style.backgroundColor = "yellow"; // Set a background color
  largeElement.style.padding = "20px";
  largeElement.style.textAlign = "center"; // Center the text
  largeElement.style.zIndex = "1000"; // Make sure it's on top of everything

  // Append the element to the body
  document.body.appendChild(largeElement);
});

//get list of job lists
console.log("Getting job list options...");
await page.waitForSelector("#quickSearchCountsContainer > table > tbody");
await Bun.sleep(3000);
const navFunctions = await page.evaluate(() => {
  return Array.from(
    document.querySelectorAll(
      "#quickSearchCountsContainer > table > tbody > tr > td.full > a"
    )
  ).map((anchorElement) =>
    anchorElement.onclick
      ? anchorElement.onclick
          .toString()
          .replace(/^function\s+\w+\(.*\)\s*{\n/, "")
          .replace(/[\n}]+$/, "")
      : null
  );
});
const navText = await page.evaluate(() => {
  return Array.from(
    document.querySelectorAll(
      "#quickSearchCountsContainer > table > tbody > tr > td.full > a"
    )
  ).map((anchorElement) =>
    anchorElement.innerHTML
      ? anchorElement.innerHTML
          .toString()
          .replace(/[\t\n]/g, "")
          .trim()
      : null
  );
});

console.log("Finished getting job list options...");
console.log("Removing irrelevant options...");

for (let i = 0; i < navFunctions.length; i++) {
  if (navFunctions[i]?.startsWith("orbisAppSr.buildForm({")) {
    navFunctions.splice(i, 1);
    navText.splice(i, 1);
  }
}

console.log("Finished removing irrelevant options...");
console.log(`Select a job list option (${0}-${navFunctions.length - 1}):`);
for (let i = 0; i < navFunctions.length; i++) {
  console.log(`\t${i}: ${navText[i]}`);
}

let funcNum: number = 0;

for await (const line of console) {
  //if line is valid number
  if (
    line.match(/^\d+$/) &&
    parseInt(line) < navFunctions.length &&
    parseInt(line) >= 0
  ) {
    funcNum = parseInt(line);
    break;
  } else {
    console.log(
      `Select a job list option (${0}-${navFunctions.length - 1})...`
    );
    for (let i = 0; i < navFunctions.length; i++) {
      console.log(`${i}: ${navText[i]}`);
    }
  }
}

console.log(`Picked option ${funcNum}: ${navText[funcNum]}`);
console.log("Opening job list...");

await page.evaluate(
  ({ funcNum, navFunctions }: { funcNum: number; navFunctions: string[] }) => {
    eval(navFunctions[funcNum]);
  },
  { funcNum, navFunctions }
);

//wait for page to load
await page.waitForNavigation({ waitUntil: "networkidle0" });

console.log("Job list opened...");
console.log("Getting job ids...");

await Bun.sleep(500);

await page.waitForSelector("span.badge.badge-info");
//await page.waitForSelector("#postingsTablePlaceholder > div > div > ul > li");
const totalResults: number = await page.evaluate(() => {
  return parseInt(
    document.querySelector("span.badge.badge-info")?.innerText || "0"
  );
});

const pageCount =
  totalResults > 100 // if there are more than 100 results, we need to get the total page count, otherwise it's just 1
    ? await page.evaluate(() => {
        return (
          document.querySelectorAll(
            "#postingsTablePlaceholder > div:nth-child(4) > div > ul > li"
          ).length - 4
        );
      })
    : 1;
console.log(`Total page count: ${pageCount}`);

for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
  await goToPage(page, pageNum);
  console.log(`Going to page ${pageNum}...`);
  await page.waitForSelector("tbody");
  await Bun.sleep(100);

  let listings: number = await page.evaluate(() => {
    return document.querySelectorAll("tbody")[0].children.length;
  }, page);
  for (let i = 1; i <= listings; i++) {
    let id = await page
      .$eval(`tbody tr:nth-child(${i})`, (el: HTMLElement) => {
        return el.id;
      })
      .catch((err: any) => {
        return null;
      });
    if (!id) {
      break;
    }
    jobsIdArray.push(id.replace("posting", ""));
  }
}

console.log("Finished getting job ids...");

//get the open job function
const openListingFunction = (
  await page.evaluate(() => {
    return document
      .querySelector("td.orgDivTitleMaxWidth.align--middle > span > a")
      ?.getAttribute("onclick")
      ?.toString()
      .replace(/^function\s+\w+\(.*\)\s*{\n/, "")
      .replace(/[\n}]+$/, "");
  })
)?.match(/'action':'(.*?)','initialSearchAction':'(.*?)'/);

let action: string = "";
let initialSearchAction: string = "";
if (openListingFunction) {
  action = openListingFunction[1];
  initialSearchAction = openListingFunction[2];
}

console.log("Starting to open job pages...");

for (let jobIdIndex = 0; jobIdIndex < jobsIdArray.length; jobIdIndex++) {
  let id: string = jobsIdArray[jobIdIndex];
  await page.evaluate(
    ({
      id,
      action,
      initialSearchAction,
    }: {
      id: string;
      action: string;
      initialSearchAction: string;
    }) => {
      orbisAppSr
        .buildForm(
          {
            action: action,
            initialSearchAction: initialSearchAction,
            searchType: "",
            accessToPostings: "infoForPostings",
            postingId: id,
            npfGroup: "",
            sortDirection: "Reverse",
          },
          "",
          "_BLANK"
        )
        .submit();
    },
    { id, action, initialSearchAction }
  );
  while (pages.length > 20) {
    console.log("Waiting for some pages to close...");
    await Bun.sleep(1000);
  }
}

while (true) {
  if (pages.length === 0) {
    break;
  }
  console.log("Waiting for pages to close...");
  await Bun.sleep(1000);
}

//write json and csv to file using bun io
console.log("Writing to file...");
await Bun.write("listings.csv", converter.json2csv(listingsArr));

try {
  console.log("Closing page...");
  await page.close();
  console.log("Page closed.");
} catch (error) {
  console.error("Error closing page:", error);
}

try {
  console.log("Closing browser...");
  await browser.close();
  console.log("Browser closed.");
} catch (error) {
  console.error("Error closing browser:", error);
}

console.log("Finished writing to file!");

const orbisAppSr = {
  // make ts happy :(
  buildForm: function (formDetails: any, arg1: string, arg2: string) {
    // Implementation of buildForm
    return {
      submit: function () {
        throw new Error("Function not implemented.");
      },
    };
  },
};

function loadPostingTable(
  arg0: string,
  arg1: string,
  arg2: string,
  arg3: string,
  arg4: string,
  arg5: string,
  arg6: any
) {
  // make ts happy
  throw new Error("Function not implemented.");
}

async function goToPage(page: Page, pageNumber: number) {
  await page.evaluate((pageNumber: number) => {
    loadPostingTable(
      "",
      "",
      "Forward",
      `${pageNumber}`,
      "jobSavedCountCurrentTerm",
      "",
      null
    );
  }, pageNumber);
}
