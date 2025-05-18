import asyncio

from antlr4 import *

from util.path import PathBuilder
from util.repo import RepositoryAnalyzer
from services.project_analyzer.antlr_ast.python.PythonLexer import PythonLexer
from services.project_analyzer.antlr_ast.python.PythonParser import PythonParser
from services.project_analyzer.antlr_ast.python.line_calculator import PythonLineCalculator
from services.project_analyzer.antlr_ast.go.GoLexer import GoLexer
from services.project_analyzer.antlr_ast.go.GoParser import GoParser
from services.project_analyzer.antlr_ast.go.line_calculator import GoLineCalculator
from services.project_analyzer.antlr_ast.java.JavaLexer import JavaLexer
from services.project_analyzer.antlr_ast.java.JavaParser import JavaParser
from services.project_analyzer.antlr_ast.java.line_calculator import JavaLineCalculator


class AstAnalyzer:
    def __init__(self, repository_name):
        self.project_name = repository_name
        self.pb = PathBuilder(self.project_name)
        self.repo_analyzer = RepositoryAnalyzer(self.pb)

    async def analyze(self, extension):
        if extension == '.py':
            return await self.analyze_python()
        elif extension == '.go':
            return await self.analyze_go()
        elif extension == '.java':
            return await self.analyze_java()

    async def analyze_python(self):
        listener = PythonLineCalculator()
        filename_and_line_list = {}
        for file in self.repo_analyzer.get_all_filenames():
            await asyncio.sleep(0.01)
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
            relative_filename = self.pb.get_relative_filepath_from_repo(file.filename)
            filename_and_line_list[relative_filename] = listener.line_list
            listener.line_list = []
            if not filename_and_line_list[relative_filename]:
                filename_and_line_list.pop(relative_filename)
                continue
            print(relative_filename, filename_and_line_list[relative_filename])
        return filename_and_line_list

    async def analyze_go(self):
        listener = GoLineCalculator()
        filename_and_line_list = {}
        for file in self.repo_analyzer.get_all_filenames():
            await asyncio.sleep(0.01)
            if not file.filename.endswith('.go'):
                print('This is not a go file.')
                continue
            try:
                input_stream = FileStream(file.filename)
            except Exception as e:
                print(f'An error occurred: {e}')
                continue
            lexer = GoLexer(input_stream)
            stream = CommonTokenStream(lexer)
            parser = GoParser(stream)
            walker = ParseTreeWalker()
            walker.walk(listener, parser.sourceFile())
            relative_filename = self.pb.get_relative_filepath_from_repo(file.filename)
            filename_and_line_list[relative_filename] = listener.line_list
            listener.line_list = []
            if not filename_and_line_list[relative_filename]:
                filename_and_line_list.pop(relative_filename)
                continue
            print(relative_filename, filename_and_line_list[relative_filename])
        return filename_and_line_list

    async def analyze_java(self):
        listener = JavaLineCalculator()
        filename_and_line_list = {}
        for file in self.repo_analyzer.get_all_filenames():
            await asyncio.sleep(0.01)
            if not file.filename.endswith('.java'):
                print('This is not a java file.')
                continue
            try:
                input_stream = FileStream(file.filename)
            except Exception as e:
                print(f'An error occurred: {e}')
                continue
            lexer = JavaLexer(input_stream)
            stream = CommonTokenStream(lexer)
            parser = JavaParser(stream)
            walker = ParseTreeWalker()
            walker.walk(listener, parser.compilationUnit())
            relative_filename = self.pb.get_relative_filepath_from_repo(file.filename)
            filename_and_line_list[relative_filename] = listener.line_list
            listener.line_list = []
            if not filename_and_line_list[relative_filename]:
                filename_and_line_list.pop(relative_filename)
                continue
            print(relative_filename, filename_and_line_list[relative_filename])
        return filename_and_line_list


if __name__ == "__main__":
    ast_analyzer = AstAnalyzer("go-jsonnet")
    ast_analyzer.analyze_go()
