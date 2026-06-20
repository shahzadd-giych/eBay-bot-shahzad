const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Public')));

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_CERT_ID = process.env.EBAY_CERT_ID;
const EBAY_DEV_ID = process.env.EBAY_DEV_ID;
const EBAY_TOKEN = process.env.EBAY_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

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

app.post('/api/analyze', async (req, res) => {
  const { url } = req.body;
  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are an expert eBay UK seller. Analyze this supplier URL and create an optimized eBay UK listing: ${url}
Respond ONLY with valid JSON no markdown:
{"title":"SEO title max 80 chars","description":"3-4 sentence description for UK buyers","keywords":["k1","k2","k3","k4","k5","k6"],"specs":"Brand: X\\nModel: X\\nCondition: New\\nColour: X","suggestedPrice":"19.99","costPrice":"8.50","profit":"11.49","veroRisk":"safe","veroNote":"No VeRO brand detected","categoryId":"9355"}`
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    const text = response.data.content[0].text.replace(/```json|```/g,'').trim();
    const result = JSON.parse(text);
    res.json({ success: true, result });
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
    <PrimaryCategory><CategoryID>${categoryId||'9355'}</CategoryID></PrimaryCategory>
    <StartPrice>${price}</StartPrice>
    <Country>GB</Country>
    <Currency>GBP</Currency>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <PictureDetails><PictureURL>${imageUrl||''}</PictureURL></PictureDetails>
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
  console.log('Stock check: ' + new Date().toISOString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('eBay Bot running on port ' + PORT));
