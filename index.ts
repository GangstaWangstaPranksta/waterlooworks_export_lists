import type { Page, Target } from "puppeteer-core";

interface Listing {
  id: string;
  title: string;
  employer: string;
  city: string;
  location: string;
  term: string;
  length: string;
  summary?: string;
  responsibilities?: string;
  skills?: string;
  compensation?: string;
}

import converter from "json-2-csv";
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: null,
  args: ["--window-size=1280,800"],
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});

let listingsArr: Listing[] = [];
let pages: Page[] = [];

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
        location: "",
        term: "",
        length: "",
      };
      await newPage.waitForSelector("#postingDiv");
      listing.id = await newPage.evaluate(() => {
        const element = document.querySelectorAll("div h1")[1];
        if (element && element.textContent) {
          const match = element.textContent.match(/\d+/g);
          return match ? match[0] : "";
        }
        return "";
      });
      listing.title = await newPage.evaluate(() => {
        const element = document.querySelector(
          "#postingDiv > div:nth-child(1) > div.panel-body > table > tbody > tr:nth-child(3) > td:nth-child(2) > span"
        );
        return element && element.textContent
          ? element.textContent.match(/[^\t][A-z].+/g)?.[0] || ""
          : "";
      });
      listing.term = await newPage.evaluate(() => {
        const element = document.querySelector(
          "#postingDiv > div:nth-child(1) > div.panel-body > table > tbody > tr:nth-child(1) > td:nth-child(2)"
        );
        return element && element.textContent
          ? element.textContent.match(/[0-9[A-z].+/g)?.[0] || ""
          : "";
      });
      listing.employer = await newPage.evaluate(() => {
        const element = document.querySelector("div h2");
        if (element && element.textContent) {
          return element?.textContent?.match(/[A-z].+/g)?.[0] || "";
        }
        return "";
      });

      const tableLength = await newPage.evaluate(() => {
        return document.querySelectorAll("tbody")[1].children.length;
      });

      for (let i = 1; i <= tableLength; i++) {
        const keys: string[] = [
          "Job - City:",
          "Employment Location Arrangement:",
          "Work Term Duration:",
          "Job Summary:",
          "Job Responsibilities:",
          "Required Skills:",
        ];
        const key: string = await newPage.evaluate((i: number) => {
          const element = document.querySelector(
            `#postingDiv > div:nth-child(1) > div.panel-body > table > tbody > tr:nth-child(${i}) > td:nth-child(1)`
          );
          return element && element.textContent
            ? element.textContent.match(/[^\t][A-z].+/g)?.[0] || ""
            : "";
        }, i);
        if (keys.includes(key)) {
          const value = await newPage.evaluate((i: number) => {
            const element = document.querySelector(
              `#postingDiv > div:nth-child(1) > div.panel-body > table > tbody > tr:nth-child(${i}) > td:nth-child(2)`
            );
            return element && element.innerText ? element.innerText || "" : "";
          }, i);
          if (key === keys[0]) {
            listing.city = value;
          } else if (key === keys[1]) {
            listing.location = value;
          } else if (key === keys[2]) {
            listing.length = value;
          } else if (key === keys[3]) {
            listing.summary = value;
          } else if (key === keys[4]) {
            listing.responsibilities = value;
          } else if (key === keys[5]) {
            listing.skills = value;
          } else if (key === keys[6]) {
            listing.compensation = value;
          }
        }
      }

      listingsArr.push(listing);
      pages = pages.filter((page) => page !== newPage);
      newPage.close();
    }
  }
});

let jobsIdArray: string[] = [];

// open a page and wait until url is the job page
const page = await browser.newPage();
await page.goto("https://waterlooworks.uwaterloo.ca/waterloo.htm?action=login");
console.log("Waiting for login...");
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
console.log(`Select a job list option (${0}-${navFunctions.length - 1})...`);
for (let i = 0; i < navFunctions.length; i++) {
  console.log(`${i}: ${navText[i]}`);
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

await page.waitForSelector("#postingsTablePlaceholder > div > div > ul > li");

const pageCount =
  (await page.evaluate(() => {
    return (
      document.querySelectorAll(
        "#postingsTablePlaceholder > div:nth-child(4) > div > ul > li"
      ).length - 4
    );
  })) || 1;
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
//Bun.write("listings.json", JSON.stringify(listingsArr));
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
