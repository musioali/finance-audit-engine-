"""python -m tarazban: runs the service. TARAZBAN_HOST, TARAZBAN_PORT and TARAZBAN_DB change the defaults."""
import os

import uvicorn

uvicorn.run(
    'tarazban.api:app',
    host=os.environ.get('TARAZBAN_HOST', '127.0.0.1'),
    port=int(os.environ.get('TARAZBAN_PORT', '8790')),
)
