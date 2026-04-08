// ============================================================
// ADD THESE TWO ROUTES TO YOUR EXISTING proxy/server.js
// (alongside the existing /sync and /confirm routes)
// ============================================================

const SAP_BASE = 'https://my433447.businessbydesign.cloud.sap';
const SAP_USER = '_PRODUCTIONT';
const SAP_PASS = 'Welcome123';
const AUTH     = 'Basic ' + Buffer.from(`${SAP_USER}:${SAP_PASS}`).toString('base64');

// ── 1. OData Task Query ──────────────────────────────────────
// Called by frontend when a Task ID is entered in the filter.
// Hits: GET /sap/byd/odata/cust/v1/productiontask/ProductionTaskCollection
//       ?$filter=ID eq '3633'
app.post('/task-query', async (req, res) => {
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ error: { message: { value: 'taskId is required' } } });

  const url =
    `${SAP_BASE}/sap/byd/odata/cust/v1/productiontask/ProductionTaskCollection` +
    `?$filter=ID eq '${encodeURIComponent(taskId)}'` +
    `&$format=json`;           // ask SAP for JSON directly

  try {
    const sapRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': AUTH,
        'Accept':        'application/json',
        'Content-Type':  'application/json',
        'x-csrf-token':  'Fetch',             // SAP ByD requires this on reads too
      },
    });

    const body = await sapRes.text();
    console.log('[task-query] HTTP', sapRes.status, body.slice(0, 300));

    // Forward SAP's status code and body verbatim — frontend handles errors
    res.status(sapRes.ok ? 200 : sapRes.status)
       .set('Content-Type', 'application/json')
       .send(body);
  } catch (err) {
    console.error('[task-query] error:', err);
    res.status(500).json({ error: { message: { value: err.message } } });
  }
});


// ── 2. OData Task Confirm ────────────────────────────────────
// Called when user clicks "Confirm Task" for an OData-synced task.
// Hits: POST /sap/byd/odata/cust/v1/productiontask/ProductionTaskConfirmAsPlanned
//       ?ObjectID='FA163EA986DC1FE18CC8457CB034BB1A'
//
// SAP ByD OData requires a CSRF token for mutating requests.
// Step 1 – fetch the token with a HEAD/GET request.
// Step 2 – POST with that token.
app.post('/task-confirm', async (req, res) => {
  const { objectId } = req.body;
  if (!objectId) return res.status(400).json({ error: { message: { value: 'objectId is required' } } });

  const confirmUrl =
    `${SAP_BASE}/sap/byd/odata/cust/v1/productiontask/ProductionTaskConfirmAsPlanned` +
    `?ObjectID='${encodeURIComponent(objectId)}'`;

  try {
    // ── Step 1: Fetch CSRF token ─────────────────────────────
    const tokenRes = await fetch(
      `${SAP_BASE}/sap/byd/odata/cust/v1/productiontask/ProductionTaskCollection?$top=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': AUTH,
          'x-csrf-token':  'Fetch',
          'Accept':        'application/json',
        },
      }
    );
    const csrfToken = tokenRes.headers.get('x-csrf-token') || '';
    console.log('[task-confirm] CSRF token:', csrfToken);

    // ── Step 2: POST the confirm action ──────────────────────
    const sapRes = await fetch(confirmUrl, {
      method: 'POST',
      headers: {
        'Authorization': AUTH,
        'x-csrf-token':  csrfToken,
        'Accept':        'application/json',
        'Content-Type':  'application/json',
      },
      // SAP action imports often take an empty body
      body: JSON.stringify({}),
    });

    const body = await sapRes.text();
    console.log('[task-confirm] HTTP', sapRes.status, body.slice(0, 400));

    res.status(sapRes.ok ? 200 : sapRes.status)
       .set('Content-Type', 'application/json')
       .send(body || '{}');
  } catch (err) {
    console.error('[task-confirm] error:', err);
    res.status(500).json({ error: { message: { value: err.message } } });
  }
});

// ============================================================
// HOW TO TEST IN CURL (from your local machine or server):
//
// 1. Query task:
//    curl -X POST http://localhost:3000/task-query \
//      -H "Content-Type: application/json" \
//      -d '{"taskId":"3633"}'
//
// 2. Confirm task (get ObjectID from step 1 response):
//    curl -X POST http://localhost:3000/task-confirm \
//      -H "Content-Type: application/json" \
//      -d '{"objectId":"FA163EA986DC1FE18CC8457CB034BB1A"}'
// ============================================================
