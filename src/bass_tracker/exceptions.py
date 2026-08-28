class EntityNotFoundError(Exception):
    def __init__(self, entity_name: str, entity_id: str) -> None:
        super().__init__(f"{entity_name} not found: {entity_id}")


class InvalidStateError(Exception):
    pass


class ProcessorNotRegisteredError(Exception):
    pass
