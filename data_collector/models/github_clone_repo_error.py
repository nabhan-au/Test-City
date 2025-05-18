class GithubCloneRepoError(Exception):

    def __int__(self, message):
        self.__message = message

    def __str__(self):
        return self.__message
