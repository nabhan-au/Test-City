if __name__ is not None and "." in __name__:
    from .PythonParserListener import PythonParserListener
    from .PythonParser import PythonParser
else:
    from PythonParserListener import PythonParserListener
    from PythonParser import PythonParser


class LineCalculator(PythonParserListener):
    def __init__(self):
        self.line_list = []

    # Enter a parse tree produced by PythonParser#if_stmt.
    def enterIf_stmt(self, ctx:PythonParser.If_stmtContext):
        self.line_list += [ctx.start.line]

    # Enter a parse tree produced by PythonParser#while_stmt.
    def enterWhile_stmt(self, ctx:PythonParser.While_stmtContext):
        self.line_list += [ctx.start.line]

    # Enter a parse tree produced by PythonParser#for_stmt.
    def enterFor_stmt(self, ctx: PythonParser.For_stmtContext):
        self.line_list += [ctx.start.line]

    # Enter a parse tree produced by PythonParser#try_stmt.
    def enterTry_stmt(self, ctx: PythonParser.Try_stmtContext):
        self.line_list += [ctx.start.line]

    # Enter a parse tree produced by PythonParser#with_stmt.
    def enterWith_stmt(self, ctx: PythonParser.With_stmtContext):
        self.line_list += [ctx.start.line]

    # Enter a parse tree produced by PythonParser#elif_clause.
    def enterElif_clause(self, ctx:PythonParser.Elif_clauseContext):
        self.line_list += [ctx.start.line]

    # Enter a parse tree produced by PythonParser#else_clause.
    def enterElse_clause(self, ctx:PythonParser.Else_clauseContext):
        self.line_list += [ctx.start.line]

    # Enter a parse tree produced by PythonParser#finally_clause.
    def enterFinally_clause(self, ctx:PythonParser.Finally_clauseContext):
        self.line_list += [ctx.start.line]

    # Enter a parse tree produced by PythonParser#with_item.
    def enterWith_item(self, ctx:PythonParser.With_itemContext):
        self.line_list += [ctx.start.line]

    # Enter a parse tree produced by PythonParser#except_clause.
    def enterExcept_clause(self, ctx:PythonParser.Except_clauseContext):
        self.line_list += [ctx.start.line]

    # Enter a parse tree produced by PythonParser#funcdef.
    def enterFuncdef(self, ctx:PythonParser.FuncdefContext):
        self.line_list += [ctx.start.line]
