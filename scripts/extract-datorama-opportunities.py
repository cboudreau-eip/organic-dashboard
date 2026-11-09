"""Read a scoped source workbook; emit validated daily counts to a private JSON file."""
import datetime
import json
import sys
from urllib.parse import urlparse
import openpyxl

workbook = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)

def table(name):
    rows = list(workbook[name].values)
    return rows[4], rows[5:], rows[1][1]

headers, urls, period = table('SEO KPIs - Approved')
landing_rows = [r for r in urls if r[0] and r[0] != 'Totals']
assert landing_rows, 'No scope evidence'
assert all(r[0] == 'SEO' and urlparse(r[1]).hostname in ('www.medicarefaq.com', 'medicarefaq.com') for r in landing_rows), 'Unverified website/channel scope'

result = None
for sheet in ('Performance Over Time - Approve', 'Performance Over Time - Gross'):
    headers, rows, dates = table(sheet)
    assert dates == period, 'Mismatched source periods'
    index = headers.index('Opportunity Count')
    daily = {}
    for row in rows:
        if not isinstance(row[0], datetime.datetime):
            continue
        date = row[0].date().isoformat()
        assert date not in daily, 'Duplicate daily date'
        value = row[index]
        assert value is None or (type(value) in (int, float) and value >= 0 and int(value) == value), 'Invalid count'
        daily[date] = None if value is None else int(value)
    totals = [r for r in rows if r[0] == 'Totals']
    assert len(totals) == 1 and sum(v or 0 for v in daily.values()) == totals[0][index], 'Source total mismatch'
    if result is not None:
        assert daily == result['opportunities'], 'Approved/gross opportunity disagreement'
    else:
        controls = {r[0].date().isoformat(): dict(zip(('allLeads','filteredLeads','soldLeads','eipLeads','approvedMS','approvedMA'), [r[i] for i in (4,5,6,7,18,19)])) for r in rows if isinstance(r[0], datetime.datetime)}
        result = {'opportunities': daily, 'total': totals[0][index], 'controls': controls}
assert sum(r[headers.index('Lead Count (All)')] or 0 for r in rows if isinstance(r[0], datetime.datetime)) == sum(r[2] or 0 for r in landing_rows), 'Website control mismatch'
with open(sys.argv[2], 'w') as output:
    json.dump(result, output)
print(json.dumps({'days': len(result['opportunities']), 'missingDays': sum(v is None for v in result['opportunities'].values()), 'reportedSubtotal': result['total']}))
