import { useEffect, useRef } from 'react';
import { getToken } from '../api';

export function useSSE(onEvent) {
  const eventSourceRef = useRef(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const url = `/api/sse?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent?.(data);
      } catch {
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [onEvent]);

  return eventSourceRef;
}
