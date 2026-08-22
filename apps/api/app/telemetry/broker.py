from __future__ import annotations

from collections import defaultdict
from queue import Queue
from threading import RLock
from uuid import UUID

from app.domain import TelemetryEvent
from app.persistence.database import Repository


class EventBroker:
    def __init__(self, repository: Repository) -> None:
        self.repository = repository
        self._subscribers: dict[UUID, list[Queue[TelemetryEvent]]] = defaultdict(list)
        self._lock = RLock()

    def publish(self, event: TelemetryEvent) -> None:
        self.repository.add_event(event)
        with self._lock:
            subscribers = list(self._subscribers[event.execution_id])
        for subscriber in subscribers:
            subscriber.put(event)

    def subscribe(self, execution_id: UUID) -> Queue[TelemetryEvent]:
        queue: Queue[TelemetryEvent] = Queue()
        with self._lock:
            self._subscribers[execution_id].append(queue)
        return queue

    def unsubscribe(self, execution_id: UUID, queue: Queue[TelemetryEvent]) -> None:
        with self._lock:
            if queue in self._subscribers[execution_id]:
                self._subscribers[execution_id].remove(queue)
