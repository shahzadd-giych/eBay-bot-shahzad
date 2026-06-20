const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_CERT_ID = process.env.EBAY_CERT_ID;
const EBAY_DEV_ID = process.env.EBAY_DEV_ID;
const EBAY_TOKEN = process.env.EBAY_TOKEN;
const EBAY_API = 'https://api.ebay.com/ws/api.dll';

function headers(call) {
  return {
    'X-EBAY-API-SITEID': '3',
    'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
    'X-EBAY-API-CALL-NAME': call,
    'X-EBAY-API-APP-NAME': EBAY_APP_ID,
    'X-EBAY-API-CERT-NAME': EBAY_CERT_ID,
    'X-EBAY-API-DEV-NAME': EBAY_DEV_ID,
    'Content-Type': 'text/xml'
  };
}

app.get('/api/listings', async (req, res) => {
  try {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${EBAY_TOKEN}</eBayAuthToken></RequesterCredentials>
  <ActiveList><Include>true</Include><Pagination><EntriesPerPage>100</EntriesPerPage></Pagination></ActiveList>
</GetMyeBaySellingRequest>`;
    const r = await axios.post(EBAY_API, xml, { headers: headers('GetMyeBaySelling') });
    res.json({ success: true, data: r.data });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${EBAY_TOKEN}</eBayAuthToken></RequesterCredentials>
  <SoldList><Include>true</Include><Pagination><EntriesPerPage>50</EntriesPerPage></Pagination></SoldList>
</GetMyeBaySellingRequest>`;
    const r = await axios.post(EBAY_API, xml, { headers: headers('GetMyeBaySelling') });
    res.json({ success: true, data: r.data });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

app.post('/api/list', async (req, res) => {
  try {
    const { title, description, price, categoryId, imageUrl } = req.body;
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${EBAY_TOKEN}</eBayAuthToken></RequesterCredentials>
  <Item>
    <Title>${title}</Title>
    <Description><![CDATA[${description}]]></Description>
    <PrimaryCategory><CategoryID>${categoryId || '9355'}</CategoryID></PrimaryCategory>
    <StartPrice>${price}</StartPrice>
    <Country>GB</Country>
    <Currency>GBP</Currency>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <PictureDetails><PictureURL>${imageUrl || ''}</PictureURL></PictureDetails>
    <PostalCode>E1 6RF</PostalCode>
    <Quantity>10</Quantity>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <RefundOption>MoneyBack</RefundOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
    </ReturnPolicy>
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>UK_RoyalMailFirstClassStandard</ShippingService>
        <ShippingServiceCost>2.99</ShippingServiceCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    <Site>UK</Site>
    <ConditionID>1000</ConditionID>
  </Item>
</AddItemRequest>`;
    const r = await axios.post(EBAY_API, xml, { headers: headers('AddItem') });
    res.json({ success: true, data: r.data });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

app.post('/api/end-listing', async (req, res) => {
  try {
    const { itemId } = req.body;
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${EBAY_TOKEN}</eBayAuthToken></RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndItemRequest>`;
    const r = await axios.post(EBAY_API, xml, { headers: headers('EndItem') });
    res.json({ success: true, data: r.data });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/deletion', (req, res) => {
  const challenge = req.query.challenge_code;
  if (challenge) {
    const endpoint = 'https://' + req.headers.host + '/deletion';
    const hash = crypto.createHash('sha256');
    hash.update(challenge);
    hash.update('Shahzadmart2026ebaystoreverification');
    hash.update(endpoint);
    return res.json({ challengeResponse: hash.digest('hex') });
  }
  res.send('OK');
});
app.post('/deletion', (req, res) => res.sendStatus(200));

cron.schedule('*/30 * * * *', () => {
  console.log('Stock check running at ' + new Date().toISOString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('eBay Bot running on port ' + PORT));
