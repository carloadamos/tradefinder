const bodyParser = require("body-parser");
const express = require("express");
const moment = require("moment");
const request = require("request");
const fetch = require("node-fetch");
const { MongoClient } = require("mongodb");
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));

let db;

MongoClient.connect("mongodb://localhost:27017", (err, client) => {
  if (err) return console.log(err);
  db = client.db("tradefinder");

  app.listen(3000, () => {
    console.log("Listening to 3000");
  });
  return;
});

app.get("/", (req, res) => {
  const cursor = db.collection('stocks').find().toArray(function (err, documents) {
    console.log(documents);
  });

  console.log(cursor)
});

app.post("/save", (req, res) => {
  saveStockToDatabase(req.body.code);
  res.send("Nice");
});

app.post("/reset", (req, res) => {
  resetDatabase();
  res.send('Deleted')
});

function getAllStockCodes(jsonStocks) {
  let allStocks = JSON.parse(jsonStocks).stock;
  return allStocks.map(stock => {
    return stock.symbol;
  });
}

function resetDatabase() {
  db.collection("stocks").drop(function (dbErr, delOk) {
    if (dbErr) throw dbErr;
    if (delOk) console.log("Stocks collection deleted");
  });
  db.collection("stocks_error").drop(function (dbErr, delOk) {
    if (dbErr) throw dbErr;
    if (delOk) console.log("Stocks error collection deleted");
  });
}

function saveStocksToDatabase(code) {
  let startDate = moment().format("2015-01-01");
  let currentDate = moment().format("YYYY-MM-DD");
  let dateArray = [];

  while (startDate <= currentDate) {
    dateArray.push(moment(startDate).format("YYYY-MM-DD"));
    startDate = moment(startDate)
      .add(1, "days")
      .format("YYYY-MM-DD");
  }
  console.log(dateArray.length)

  dateArray.forEach(date => {
    setTimeout(() => request(
      `http://phisix-api.appspot.com/stocks/${code}.${date}.json`,
      (err, resp, body) => {
        if (!err) {
          if (body && !body.includes('html')) {
            let stock = JSON.parse(body).stock[0];
            let stockDate = moment(JSON.parse(body).as_of).format('YYYY-MM-DD');
            stock = {
              ...stock,
              currency: stock.price.currency,
              price: stock.price.amount,
              date: stockDate,
            };
            db.collection("stocks").insertOne(stock, (dbErr, dbRes) => {
              if (dbErr) return console.log(err);
            });
          }
        }
      }
    ), 500);
  });
}

function saveStockToDatabase(code) {
  let startDate = moment("2019-01-01").format("YYYY-MM-DD");
  let currentDate = moment().format("YYYY-MM-DD");
  let dateArray = [];

  while (startDate <= currentDate) {
    dateArray.push(moment(startDate).format("YYYY-MM-DD"));
    startDate = moment(startDate)
      .add(1, "days")
      .format("YYYY-MM-DD");
  }

  dateArray.forEach(date => {

    const simpleDate = moment(date).format('YYYY-MM-DD');
    const day = moment(date).format('dddd');

    fetch(`http://phisix-api.appspot.com/stocks/${code}.${date}.json`)
      .then(res => res.text())
      .then(data => {
        if (data && !data.includes('html')) {
          let stock = JSON.parse(data).stock[0];
          const asOfDate = moment(JSON.parse(data).as_of).format('YYYY-MM-DD');
          stock = {
            ...stock,
            currency: stock.price.currency,
            price: stock.price.amount,
            date: new Date(asOfDate),
          };
          db.collection("stocks").insertOne(stock, (dbErr, dbRes) => {
            if (dbErr) return console.log(err);
          });
        }
        else {
          if (!(day === 'Sunday' || day === 'Saturday')) {
              console.log(simpleDate)
              console.log(day)
              console.log(code)
            let stock = {
              code,
              date: new Date(simpleDate),
              day
            };

            console.log(`Error will be logged for ${code} ${simpleDate} ${day}`)
            db.collection("stocks_error").insertOne(stock, (dbErr, dbRes) => {
              if (dbErr) return console.log(err);
              console.log(`Error logged for ${code} ${simpleDate} ${day}`)
            });
          }
        }
      })
      .catch(error => console.log('error', error))
  });
}

function saveAllStockToDatabase() {
  request("http://phisix-api.appspot.com/stocks.json", (err, resp, body) => {
    let stockCodes = getAllStockCodes(body);

    stockCodes.forEach(code => {
      request(
        `http://phisix-api.appspot.com/stocks/${code}.json`,
        (err, resp, body) => {
          let stock = JSON.parse(body).stock[0];
          db.collection("stocks").insertOne(stock, (dbErr, dbRes) => {
            if (dbErr) return console.log(err);
          });
        }
      );
    });
  });
}
