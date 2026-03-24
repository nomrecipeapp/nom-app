{screen === 'search' && (
        <Search
          session={session}
          onSelectUser={goToFriendProfile}
          onSelectSave={goToFriendRecipeDetail}
          onSelectCook={goToSocialRecipe}
        />
      )}