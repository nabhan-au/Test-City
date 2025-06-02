class CommonResponse:

    def __init__(self, is_success, message) -> None:
        self.is_success = is_success
        self.message = message

    def to_json(self):
        return {
            "is_success": self.is_success,
            "message": self.message
        }