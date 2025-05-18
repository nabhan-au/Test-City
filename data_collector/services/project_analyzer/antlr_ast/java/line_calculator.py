if __name__ is not None and "." in __name__:
    from .JavaParserListener import JavaParserListener
    from .JavaParser import JavaParser
else:
    from JavaParserListener import JavaParserListener
    from JavaParser import JavaParser


class JavaLineCalculator(JavaParserListener):
    def __init__(self):
        self.line_list = []

    # Enter a parse tree produced by JavaParser#block.
    def enterBlock(self, ctx: JavaParser.BlockContext):
        self.line_list += [ctx.start.line]
