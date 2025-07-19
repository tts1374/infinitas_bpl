class ProgramUpdateResult:
    def __init__(self, need_update=False, error=None):
        self.need_update = need_update
        self.error = error