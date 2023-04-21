from antlr4 import *

from util.path import PathBuilder
from util.repo import RepositoryAnalyzer
from project_analyzer.antlr_ast.PythonLexer import PythonLexer
from project_analyzer.antlr_ast.PythonParser import PythonParser
from project_analyzer.antlr_ast.line_calculator import LineCalculator


class AstAnalyzer:
    def __init__(self, repository_name):
        self.project_name = repository_name

    def analyze(self):
        listener = LineCalculator()
        pb = PathBuilder(self.project_name)
        repo_analyzer = RepositoryAnalyzer(pb)
        filename_and_line_list = {}
        for file in repo_analyzer.get_all_filenames():
            if not file.filename.endswith('.py'):
                print('This is not a python file.')
                continue
            try:
                input_stream = FileStream(file.filename)
            except Exception as e:
                print(f'An error occurred: {e}')
                continue
            lexer = PythonLexer(input_stream)
            stream = CommonTokenStream(lexer)
            parser = PythonParser(stream)
            walker = ParseTreeWalker()
            walker.walk(listener, parser.root())
            relative_filename = pb.get_relative_filepath_from_repo(file.filename)
            filename_and_line_list[relative_filename] = listener.line_list
            listener.line_list = []
            if not filename_and_line_list[relative_filename]:
                filename_and_line_list.pop(relative_filename)
                continue
            print(relative_filename, filename_and_line_list[relative_filename])
        return filename_and_line_list


if __name__ == "__main__":
    ast_analyzer = AstAnalyzer("openhtf")
    ast_analyzer.analyze()
