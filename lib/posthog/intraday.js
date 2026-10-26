export function isInstant(value) {
 return typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value) &&
   Number.isFinite(Date.parse(value)) && new Date(value).toISOString()===value;
}
export function instantSql(value) {
 if(!isInstant(value))throw new Error('Invalid reporting timestamp.');
 return "toDateTime("+Date.parse(value)/1000+", 'UTC')";
}
export function shiftInstant(value,hours) {
 if(!isInstant(value))throw new Error('Invalid reporting timestamp.');
 return new Date(Date.parse(value)+hours*3600000).toISOString();
}
export function hourlyQuery(start,end) {
 const from=instantSql(start),to=instantSql(end);
 if(Date.parse(end)-Date.parse(start)!==86400000)throw new Error('Expected an exact 24-hour window.');
 return {kind:'HogQLQuery',query:`SELECT floor(dateDiff('second', ${from}, timestamp)/3600) AS bucket, count() AS views
 FROM events WHERE timestamp>=${from} AND timestamp<${to}
 AND event='$pageview' AND properties.$host IN ('www.medicarefaq.com','medicarefaq.com')
 AND properties.$sdk_dist_channel='cdn' AND session.$channel_type='Organic Search'
 GROUP BY bucket ORDER BY bucket`};
}
export function parseHourly(response,start) {
 if(response.error||!Array.isArray(response.results))throw new Error('Hourly traffic is incomplete.');
 const buckets=new Map();
 for(const row of response.results){
  if(!Array.isArray(row)||row.length!==2||!Number.isInteger(row[0])||row[0]<0||row[0]>23||!Number.isSafeInteger(row[1])||row[1]<0||buckets.has(row[0]))throw new Error('Hourly traffic could not be validated.');
  buckets.set(row[0],row[1]);
 }
 return Array.from({length:24},(_,i)=>({date:shiftInstant(start,i),views:buckets.get(i)||0}));
}
