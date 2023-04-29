if __name__ is not None and "." in __name__:
    from .GoParserListener import GoParserListener
    from .GoParser import GoParser
else:
    from GoParserListener import GoParserListener
    from GoParser import GoParser


class GoLineCalculator(GoParserListener):
    def __init__(self):
        self.line_list = []

    # Enter a parse tree produced by GoParser#block.
    def enterBlock(self, ctx: GoParser.BlockContext):
        self.line_list += [ctx.start.line]
